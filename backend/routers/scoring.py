"""
FastAPI router for ATS scoring and resume editing endpoints.
"""

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
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


class ATSResultResponse(BaseModel):
    application_id: int
    ats_score: Optional[float]
    keyword_score: Optional[float]
    experience_score: Optional[float]
    education_score: Optional[float]
    skills_score: Optional[float]
    matched_keywords: list[str]
    missing_keywords: list[str]
    suggestions: list[str]
    ats_friendly_issues: list[str]
    verdict: Optional[str]
    human_approved: bool
    edited_resume_path: Optional[str]
    status: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_result_response(application: Application) -> ATSResultResponse:
    breakdown = application.ats_breakdown or {}
    return ATSResultResponse(
        application_id=application.id,
        ats_score=application.ats_score,
        keyword_score=breakdown.get("keyword_score"),
        experience_score=breakdown.get("experience_score"),
        education_score=breakdown.get("education_score"),
        skills_score=breakdown.get("skills_score"),
        matched_keywords=breakdown.get("matched_keywords", []),
        missing_keywords=breakdown.get("missing_keywords", []),
        suggestions=breakdown.get("suggestions", []),
        ats_friendly_issues=breakdown.get("ats_friendly_issues", []),
        verdict=breakdown.get("verdict"),
        human_approved=application.human_approved,
        edited_resume_path=application.edited_resume_path,
        status=application.status.value if application.status else "pending",
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
            detail="Job has no description to score against. Please add a description first.",
        )

    if not resume.content:
        raise HTTPException(
            status_code=422,
            detail="Resume has no text content. Please re-upload or re-parse the resume.",
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
    except Exception as exc:
        application.status = ApplicationStatus.pending
        db.commit()
        logger.error("ATS scoring failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"ATS scoring failed: {exc}")

    # Persist results
    application.ats_score = analysis["overall_score"]
    application.ats_breakdown = analysis
    application.status = ApplicationStatus.reviewing
    db.commit()

    # Create ATSAnalysis record
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
    Use Claude to edit the resume associated with an application
    to better match the job description.
    Saves the edited resume text as a .txt file and updates the application record.
    """
    application = db.query(Application).filter(Application.id == request.application_id).first()
    if not application:
        raise HTTPException(
            status_code=404, detail=f"Application {request.application_id} not found"
        )

    if not application.ats_breakdown:
        raise HTTPException(
            status_code=422,
            detail="Application has no ATS analysis. Run /scoring/analyze first.",
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
    except Exception as exc:
        logger.error("Resume editing failed for application %d: %s", application.id, exc)
        raise HTTPException(status_code=500, detail=f"Resume edit failed: {exc}")

    # Save edited resume to disk
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    edited_filename = f"edited_resume_app{application.id}_{ts}.txt"
    edited_path = EDITED_RESUMES_DIR / edited_filename
    try:
        edited_path.write_text(edited_text, encoding="utf-8")
    except OSError as exc:
        logger.error("Could not save edited resume: %s", exc)
        raise HTTPException(status_code=500, detail=f"Could not save edited resume: {exc}")

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
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=404, detail=f"Application {application_id} not found"
        )
    return _build_result_response(application)


@router.post("/approve/{application_id}", response_model=ATSResultResponse)
def approve_application(application_id: int, db: Session = Depends(get_db)):
    """
    Human approves the edited resume.
    Sets human_approved=True so the auto-apply step can proceed.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=404, detail=f"Application {application_id} not found"
        )

    if not application.edited_resume_path:
        raise HTTPException(
            status_code=422,
            detail="No edited resume exists for this application. Run /scoring/edit first.",
        )

    application.human_approved = True
    db.commit()
    db.refresh(application)

    logger.info("Application %d approved by human", application.id)
    return _build_result_response(application)
