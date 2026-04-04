"""
FastAPI router for application management and auto-apply endpoints.
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Application, ApplicationStatus, Job, JobStatus, Resume
from services.auto_applier import apply_to_job

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/applications", tags=["applications"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ApplicationResponse(BaseModel):
    id: int
    job_id: int
    resume_id: int
    job_title: Optional[str]
    company: Optional[str]
    resume_filename: Optional[str]
    ats_score: Optional[float]
    edited_resume_path: Optional[str]
    status: str
    human_approved: bool
    created_at: datetime
    applied_at: Optional[datetime]

    class Config:
        from_attributes = True


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus


class StatsResponse(BaseModel):
    total: int
    pending: int
    reviewing: int
    applying: int
    submitted: int
    failed: int
    success_rate: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _app_to_response(app: Application) -> ApplicationResponse:
    return ApplicationResponse(
        id=app.id,
        job_id=app.job_id,
        resume_id=app.resume_id,
        job_title=app.job.title if app.job else None,
        company=app.job.company if app.job else None,
        resume_filename=app.resume.filename if app.resume else None,
        ats_score=app.ats_score,
        edited_resume_path=app.edited_resume_path,
        status=app.status.value if app.status else "pending",
        human_approved=app.human_approved,
        created_at=app.created_at,
        applied_at=app.applied_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ApplicationResponse])
def list_applications(db: Session = Depends(get_db)):
    """List all applications with their associated job and resume details."""
    apps = (
        db.query(Application)
        .order_by(Application.created_at.desc())
        .all()
    )
    return [_app_to_response(a) for a in apps]


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Return aggregate application statistics."""
    total = db.query(Application).count()

    def _count(status: ApplicationStatus) -> int:
        return db.query(Application).filter(Application.status == status).count()

    submitted = _count(ApplicationStatus.submitted)
    success_rate = round((submitted / total * 100), 1) if total > 0 else 0.0

    return StatsResponse(
        total=total,
        pending=_count(ApplicationStatus.pending),
        reviewing=_count(ApplicationStatus.reviewing),
        applying=_count(ApplicationStatus.applying),
        submitted=submitted,
        failed=_count(ApplicationStatus.failed),
        success_rate=success_rate,
    )


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(application_id: int, db: Session = Depends(get_db)):
    """Return a single application by ID."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail=f"Application {application_id} not found")
    return _app_to_response(app)


@router.post("/{application_id}/apply", response_model=dict)
def trigger_apply(
    application_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Trigger the auto-apply workflow for an application.
    Requires human_approved=True before proceeding.
    Runs Playwright in a background task and returns immediately.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail=f"Application {application_id} not found")

    if not app.human_approved:
        raise HTTPException(
            status_code=403,
            detail="Application must be human-approved before auto-apply. "
                   "POST /scoring/approve/{application_id} first.",
        )

    if app.status == ApplicationStatus.submitted:
        raise HTTPException(
            status_code=409, detail="Application has already been submitted."
        )

    job = app.job
    resume = app.resume

    if not job or not resume:
        raise HTTPException(status_code=404, detail="Job or resume record no longer exists.")

    if not job.url:
        raise HTTPException(status_code=422, detail="Job has no application URL.")

    # Build resume_data dict from parsed_data + original_path
    resume_data = dict(resume.parsed_data or {})
    resume_data["original_path"] = resume.original_path

    # Mark as 'applying' immediately
    app.status = ApplicationStatus.applying
    db.commit()

    async def _run_apply():
        """Async wrapper that runs in the background task event loop."""
        result = await apply_to_job(
            job_url=job.url,
            resume_data=resume_data,
            edited_resume_path=app.edited_resume_path,
        )

        # Re-open a new DB session for the background task
        from database import SessionLocal
        bg_db = SessionLocal()
        try:
            bg_app = bg_db.query(Application).filter(Application.id == application_id).first()
            if not bg_app:
                return

            apply_status = result.get("status", "error")
            if apply_status in ("success", "partial"):
                bg_app.status = ApplicationStatus.submitted
                bg_app.applied_at = datetime.utcnow()
                bg_job = bg_db.query(Job).filter(Job.id == bg_app.job_id).first()
                if bg_job:
                    bg_job.status = JobStatus.applied
            else:
                bg_app.status = ApplicationStatus.failed

            # Attach Playwright result to ats_breakdown
            breakdown = dict(bg_app.ats_breakdown or {})
            breakdown["auto_apply_result"] = result
            bg_app.ats_breakdown = breakdown
            bg_db.commit()
        except Exception as exc:
            logger.error("Background apply task error for application %d: %s", application_id, exc)
        finally:
            bg_db.close()

    def _run_in_thread():
        """Run the async function in a new event loop (background thread)."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_run_apply())
        finally:
            loop.close()

    background_tasks.add_task(_run_in_thread)

    return {
        "message": "Auto-apply started in background.",
        "application_id": application_id,
        "status": "applying",
    }


@router.put("/{application_id}/status", response_model=ApplicationResponse)
def update_application_status(
    application_id: int,
    body: ApplicationStatusUpdate,
    db: Session = Depends(get_db),
):
    """Manually update an application's status."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail=f"Application {application_id} not found")

    app.status = body.status
    if body.status == ApplicationStatus.submitted and not app.applied_at:
        app.applied_at = datetime.utcnow()

    db.commit()
    db.refresh(app)
    return _app_to_response(app)
