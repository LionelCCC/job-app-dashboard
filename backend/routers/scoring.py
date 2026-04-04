"""
FastAPI router for ATS scoring and resume editing endpoints.
"""

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Application, ATSAnalysis, ApplicationStatus, Job, JobStatus, Resume
from services.ats_scorer import edit_resume_for_job, score_resume

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scoring", tags=["scoring"])

EDITED_RESUMES_DIR = Path("/Users/lionelc/Job app dashboard/backend/resumes/edited")
EDITED_RESUMES_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    job_id: int
    resume_id: int


class EditRequest(BaseModel):
    application_id: int


class ATSBreakdownSchema(BaseModel):
    keyword_score: float
    experience_score: float
    education_score: float
    skills_score: float


class ATSResultResponse(BaseModel):
    """
    Matches the TypeScript ATSResult interface in frontend/src/lib/api.ts exactly.
    Fields: application_id, job_id, resume_id, overall_score, breakdown (nested),
    matched_keywords, missing_keywords, suggestions, ats_friendly_issues,
    verdict, human_approved, edited_resume_path, status, created_at
    """
    application_id: int
    job_id: int
    resume_id: int
    overall_score: float
    breakdown: Optional[ATSBreakdownSchema] = None
    matched_keywords: list[str]
    missing_keywords: list[str]
    suggestions: list[str]
    ats_friendly_issues: list[str]
    verdict: Optional[str] = None
    human_approved: bool
    edited_resume_path: Optional[str] = None
    status: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_result_response(application: Application) -> ATSResultResponse:
    """
    Convert an Application ORM object into the ATSResultResponse schema.
    The ats_breakdown JSON field stores the full analysis dict from score_resume().
    """
    raw = application.ats_breakdown or {}

    # Build nested breakdown only if sub-scores exist
    breakdown = None
    if raw.get("keyword_score") is not None:
        breakdown = ATSBreakdownSchema(
            keyword_score=float(raw.get("keyword_score", 0)),
            experience_score=float(raw.get("experience_score", 0)),
            education_score=float(raw.get("education_score", 0)),
            skills_score=float(raw.get("skills_score", 0)),
        )

    return ATSResultResponse(
        application_id=application.id,
        job_id=application.job_id,
        resume_id=application.resume_id,
        overall_score=float(application.ats_score or 0),
        breakdown=breakdown,
        matched_keywords=raw.get("matched_keywords", []),
        missing_keywords=raw.get("missing_keywords", []),
        suggestions=raw.get("suggestions", []),
        ats_friendly_issues=raw.get("ats_friendly_issues", []),
        verdict=raw.get("verdict"),
        human_approved=bool(application.human_approved),
        edited_resume_path=application.edited_resume_path,
        status=application.status.value if application.status else "pending",
        created_at=application.created_at.isoformat() if application.created_at else None,
    )


def _get_or_create_application(job_id: int, resume_id: int, db: Session) -> Application:
    """Return an existing pending application or create a new one."""
    app = (
        db.query(Application)
        .filter(Application.job_id == job_id, Application.resume_id == resume_id)
        .first()
    )
    if app:
        return app

    app = Application(
        job_id=job_id,
        resume_id=resume_id,
        status=ApplicationStatus.pending,
        human_approved=False,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=ATSResultResponse)
def analyze_resume(request: AnalyzeRequest, db: Session = Depends(get_db)):
    """
    Score a resume against a job description using Claude.
    Creates or updates an Application record with the ATS result.
    Returns the full ATSResultResponse matching the frontend ATSResult type.
    """
    job = db.query(Job).filter(Job.id == request.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {request.job_id} not found")

    resume = db.query(Resume).filter(Resume.id == request.resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail=f"Resume {request.resume_id} not found")

    if not job.description:
        raise HTTPException(
            status_code=422,
            detail=(
                "This job has no description to score against. "
                "Use 'Add Job by URL' to fetch the full job posting first."
            ),
        )

    if not resume.content:
        raise HTTPException(
            status_code=422,
            detail="Resume has no extracted text content. Please re-upload the file.",
        )

    application = _get_or_create_application(request.job_id, request.resume_id, db)
    application.status = ApplicationStatus.reviewing
    db.commit()

    try:
        analysis = score_resume(
            resume_text=resume.content,
            job_description=job.description,
            job_title=job.title,
        )
    except RuntimeError as exc:
        # ANTHROPIC_API_KEY missing or API failure
        application.status = ApplicationStatus.pending
        db.commit()
        logger.error("ATS scoring failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        application.status = ApplicationStatus.pending
        db.commit()
        logger.error("ATS scoring unexpected error: %s", exc)
        raise HTTPException(status_code=500, detail=f"ATS scoring failed: {exc}")

    # Persist results
    application.ats_score = analysis["overall_score"]
    application.ats_breakdown = analysis       # stores full dict incl. sub-scores + keywords
    application.status = ApplicationStatus.reviewing
    db.commit()

    # Create/update ATSAnalysis record
    existing_record = (
        db.query(ATSAnalysis)
        .filter(ATSAnalysis.application_id == application.id)
        .first()
    )
    if existing_record:
        existing_record.score = analysis["overall_score"]
        existing_record.keyword_score = analysis["keyword_score"]
        existing_record.experience_score = analysis["experience_score"]
        existing_record.education_score = analysis["education_score"]
        existing_record.skills_score = analysis["skills_score"]
        existing_record.suggestions = analysis["suggestions"]
        existing_record.matched_keywords = analysis["matched_keywords"]
        existing_record.missing_keywords = analysis["missing_keywords"]
    else:
        ats_record = ATSAnalysis(
            application_id=application.id,
            score=analysis["overall_score"],
            keyword_score=analysis["keyword_score"],
            experience_score=analysis["experience_score"],
            education_score=analysis["education_score"],
            skills_score=analysis["skills_score"],
            suggestions=analysis["suggestions"],
            matched_keywords=analysis["matched_keywords"],
            missing_keywords=analysis["missing_keywords"],
        )
        db.add(ats_record)

    # Update job status to scored
    job.status = JobStatus.scored
    db.commit()
    db.refresh(application)

    logger.info(
        "Scored application id=%d score=%.1f verdict=%s",
        application.id,
        analysis["overall_score"],
        analysis["verdict"],
    )
    return _build_result_response(application)


@router.post("/edit", response_model=ATSResultResponse)
def edit_resume(request: EditRequest, db: Session = Depends(get_db)):
    """
    Use Claude to rewrite the resume to better match the job description.
    Saves the edited resume text to disk and updates the application record.
    Returns updated ATSResultResponse with edited_resume_path set.
    """
    application = db.query(Application).filter(
        Application.id == request.application_id
    ).first()
    if not application:
        raise HTTPException(
            status_code=404,
            detail=f"Application {request.application_id} not found",
        )

    if not application.ats_breakdown:
        raise HTTPException(
            status_code=422,
            detail=(
                "No ATS analysis found for this application. "
                "Run POST /scoring/analyze first."
            ),
        )

    job = application.job
    resume = application.resume

    if not job or not resume:
        raise HTTPException(status_code=404, detail="Job or resume no longer exists.")

    try:
        edited_text = edit_resume_for_job(
            resume_text=resume.content or "",
            job_description=job.description or "",
            ats_analysis=application.ats_breakdown,
        )
    except RuntimeError as exc:
        logger.error("Resume editing failed for application %d: %s", application.id, exc)
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.error("Resume editing unexpected error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Resume edit failed: {exc}")

    # Save edited resume to disk
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    edited_filename = f"edited_resume_app{application.id}_{ts}.txt"
    edited_path = EDITED_RESUMES_DIR / edited_filename
    try:
        edited_path.write_text(edited_text, encoding="utf-8")
    except OSError as exc:
        logger.error("Could not save edited resume: %s", exc)
        raise HTTPException(
            status_code=500, detail=f"Could not save edited resume file: {exc}"
        )

    application.edited_resume_path = str(edited_path)
    db.commit()
    db.refresh(application)

    logger.info(
        "Edited resume saved for application id=%d path=%s",
        application.id,
        edited_path,
    )
    return _build_result_response(application)


@router.get("/result/{application_id}", response_model=ATSResultResponse)
def get_scoring_result(application_id: int, db: Session = Depends(get_db)):
    """Return the current ATS scoring result for an application."""
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()
    if not application:
        raise HTTPException(
            status_code=404,
            detail=f"Application {application_id} not found",
        )
    return _build_result_response(application)


@router.post("/approve/{application_id}", response_model=ATSResultResponse)
def approve_application(application_id: int, db: Session = Depends(get_db)):
    """
    Human approves the edited resume for this application.
    Sets human_approved=True so the auto-apply step can proceed.
    Also available before editing if the original resume score is acceptable.
    """
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()
    if not application:
        raise HTTPException(
            status_code=404,
            detail=f"Application {application_id} not found",
        )

    application.human_approved = True
    db.commit()
    db.refresh(application)

    logger.info("Application %d approved by human", application.id)
    return _build_result_response(application)
