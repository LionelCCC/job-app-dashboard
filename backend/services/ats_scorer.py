"""
ATS scoring service for the Job Application Pipeline Dashboard.
Uses Claude claude-opus-4-6 with extended thinking + streaming to score resumes against JDs
and to produce an edited resume optimised for a specific job.
"""

import json
import logging
import os
import re
from typing import Any

import anthropic

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Client factory (singleton-ish)
# ---------------------------------------------------------------------------

def _get_client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY environment variable is not set. "
            "Export it before starting the server."
        )
    return anthropic.Anthropic(api_key=api_key)


# ---------------------------------------------------------------------------
# Helper: extract JSON from a potentially fenced response
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict:
    """
    Attempt to parse JSON from the assistant's response text.
    Handles ```json ... ``` fences and bare JSON objects.
    """
    # Strip markdown code fences if present
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        return json.loads(fenced.group(1))

    # Try to find a raw JSON object
    raw = re.search(r"\{.*\}", text, re.DOTALL)
    if raw:
        return json.loads(raw.group(0))

    raise ValueError(f"No JSON object found in response:\n{text[:500]}")


# ---------------------------------------------------------------------------
# ATS scoring
# ---------------------------------------------------------------------------

_SCORE_SYSTEM_PROMPT = """You are a dual-role expert: an ATS (Applicant Tracking System) parser
AND an experienced technical recruiter. Your job is to objectively evaluate how well a resume
matches a job description.

You MUST respond with a single, valid JSON object — no extra text, no markdown fences.

The JSON schema is:
{
  "overall_score": <int 0-100>,
  "keyword_score": <int 0-100>,
  "experience_score": <int 0-100>,
  "education_score": <int 0-100>,
  "skills_score": <int 0-100>,
  "matched_keywords": [<str>, ...],
  "missing_keywords": [<str>, ...],
  "suggestions": [<str>, ...],
  "ats_friendly_issues": [<str>, ...],
  "verdict": "PASS" | "FAIL"
}

Scoring criteria:
- keyword_score: percentage of JD keywords/phrases found verbatim in the resume (0-100)
- experience_score: relevance and depth of experience vs. JD requirements (0-100)
- education_score: education fit to minimum requirements stated in JD (0-100)
- skills_score: alignment of listed skills to JD required/preferred skills (0-100)
- overall_score: weighted average (keywords 30%, experience 35%, education 15%, skills 20%)
- verdict: PASS if overall_score >= 70, FAIL otherwise
- suggestions: list of 3-7 actionable improvements the candidate can make
- ats_friendly_issues: formatting/structural issues that trip up ATS parsers
"""

def score_resume(
    resume_text: str,
    job_description: str,
    job_title: str,
) -> dict[str, Any]:
    """
    Score a resume against a job description using Claude claude-opus-4-6 with
    extended thinking (budget_tokens=8000) and streaming (get_final_message).

    Parameters
    ----------
    resume_text : str
        Full plain-text content of the resume.
    job_description : str
        Full plain-text job description.
    job_title : str
        Title of the job (for context).

    Returns
    -------
    dict with keys: overall_score, keyword_score, experience_score,
        education_score, skills_score, matched_keywords, missing_keywords,
        suggestions, ats_friendly_issues, verdict
    """
    client = _get_client()

    user_message = (
        f"## Job Title\n{job_title}\n\n"
        f"## Job Description\n{job_description}\n\n"
        f"## Resume\n{resume_text}"
    )

    try:
        # Use streaming with get_final_message() as required
        with client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=_SCORE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            final_message = stream.get_final_message()

        # Extract the text block from the response
        response_text = ""
        for block in final_message.content:
            if block.type == "text":
                response_text += block.text

        result = _extract_json(response_text)

        # Validate and normalise
        def _clamp(v: Any) -> float:
            try:
                return max(0.0, min(100.0, float(v)))
            except (TypeError, ValueError):
                return 0.0

        normalised = {
            "overall_score": _clamp(result.get("overall_score", 0)),
            "keyword_score": _clamp(result.get("keyword_score", 0)),
            "experience_score": _clamp(result.get("experience_score", 0)),
            "education_score": _clamp(result.get("education_score", 0)),
            "skills_score": _clamp(result.get("skills_score", 0)),
            "matched_keywords": list(result.get("matched_keywords", [])),
            "missing_keywords": list(result.get("missing_keywords", [])),
            "suggestions": list(result.get("suggestions", [])),
            "ats_friendly_issues": list(result.get("ats_friendly_issues", [])),
            "verdict": result.get("verdict", "FAIL") if result.get("overall_score", 0) >= 70 else "FAIL",
        }
        # Re-compute verdict based on score to guard against model errors
        normalised["verdict"] = "PASS" if normalised["overall_score"] >= 70 else "FAIL"

        logger.info(
            "ATS score for job_title=%r: overall=%.1f verdict=%s",
            job_title,
            normalised["overall_score"],
            normalised["verdict"],
        )
        return normalised

    except json.JSONDecodeError as exc:
        logger.error("JSON parse error in ATS score response: %s", exc)
        raise ValueError(f"Failed to parse ATS score JSON from Claude response: {exc}") from exc
    except anthropic.APIError as exc:
        logger.error("Anthropic API error during ATS scoring: %s", exc)
        raise RuntimeError(f"Anthropic API call failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Resume editor
# ---------------------------------------------------------------------------

_EDIT_SYSTEM_PROMPT = """You are an expert resume writer and career coach.
Your task is to edit the provided resume so it better matches a specific job description.

Rules you MUST follow:
1. Do NOT fabricate any experience, companies, dates, degrees, or certifications.
2. Do NOT change the candidate's name, contact information, or job history.
3. You MAY reword bullet points to use the JD's exact terminology if the underlying
   experience genuinely supports it.
4. You MAY add skills to the skills section only if they are clearly implied by the
   existing experience (e.g. if they worked at AWS for 3 years, adding "AWS" is fine).
5. You MAY reorganise sections to surface the most relevant experience first.
6. Improve keyword density for the missing keywords listed in the ATS analysis.
7. Keep the resume concise — do not make it longer than 2 pages of content.
8. Return ONLY the full edited resume text — no explanations, no preamble.
"""

def edit_resume_for_job(
    resume_text: str,
    job_description: str,
    ats_analysis: dict,
) -> str:
    """
    Use Claude to edit the resume to better match the JD.

    Parameters
    ----------
    resume_text : str
        Original resume plain text.
    job_description : str
        Full plain-text job description.
    ats_analysis : dict
        Output of `score_resume()`.

    Returns
    -------
    str
        Full text of the edited resume.
    """
    client = _get_client()

    missing_kw = ", ".join(ats_analysis.get("missing_keywords", []))
    suggestions = "\n".join(f"- {s}" for s in ats_analysis.get("suggestions", []))

    user_message = (
        f"## Job Description\n{job_description}\n\n"
        f"## Missing Keywords (add where truthfully applicable)\n{missing_kw}\n\n"
        f"## ATS Suggestions to Address\n{suggestions}\n\n"
        f"## Original Resume\n{resume_text}\n\n"
        "Please return the fully edited resume text only."
    )

    try:
        with client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=_EDIT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            final_message = stream.get_final_message()

        edited_text = ""
        for block in final_message.content:
            if block.type == "text":
                edited_text += block.text

        if not edited_text.strip():
            raise ValueError("Claude returned an empty edited resume.")

        logger.info("Resume edit complete. Length: %d chars", len(edited_text))
        return edited_text.strip()

    except anthropic.APIError as exc:
        logger.error("Anthropic API error during resume editing: %s", exc)
        raise RuntimeError(f"Anthropic API call failed: {exc}") from exc
