"""
Main FastAPI application entry point for the Job Application Pipeline Dashboard.

Start the server with:
    uvicorn main:app --reload --port 8000
"""

import asyncio
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import models_history
from database import create_all_tables, engine, get_db
from models import Job, Resume, Application, ATSAnalysis, JobStatus, ApplicationStatus
from routers import applications, jobs, resumes, scoring
from routers.history import router as history_router
from services.site_monitor import run_scheduler_loop

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Directories that must exist at startup
# ---------------------------------------------------------------------------

_REQUIRED_DIRS = [
    Path("/Users/lionelc/Job app dashboard/backend/resumes/uploaded"),
    Path("/Users/lionelc/Job app dashboard/backend/resumes/edited"),
    Path("/Users/lionelc/Job app dashboard/backend/screenshots"),
]

for _d in _REQUIRED_DIRS:
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# App instantiation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Job Application Pipeline API",
    description=(
        "Backend API for the Job Application Pipeline Dashboard. "
        "Manages job listings, resumes, ATS scoring, and automated applications."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS – allow all origins for local development
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static file serving
# ---------------------------------------------------------------------------

SCREENSHOTS_DIR = Path("/Users/lionelc/Job app dashboard/backend/screenshots")
app.mount(
    "/screenshots",
    StaticFiles(directory=str(SCREENSHOTS_DIR)),
    name="screenshots",
)

EDITED_RESUMES_DIR = Path("/Users/lionelc/Job app dashboard/backend/resumes/edited")
app.mount(
    "/edited-resumes",
    StaticFiles(directory=str(EDITED_RESUMES_DIR)),
    name="edited_resumes",
)

# ---------------------------------------------------------------------------
# Startup event
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup():
    """Create database tables on application startup and launch the scheduler."""
    logger.info("Creating database tables if they do not exist…")
    create_all_tables()
    # Create history tables (TrackedSite, SiteCheckLog) using their own metadata
    models_history.Base.metadata.create_all(bind=engine)
    logger.info("Database ready at /Users/lionelc/Job app dashboard/jobs.db")
    # Start the background site-monitoring scheduler
    asyncio.create_task(run_scheduler_loop())
    logger.info("Site-monitor scheduler task started.")


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(jobs.router, prefix="/api")
app.include_router(resumes.router, prefix="/api")
app.include_router(scoring.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(history_router, prefix="/api/history", tags=["history"])

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/stats", tags=["stats"])
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Aggregate stats for the main dashboard page."""
    from sqlalchemy import func

    total_jobs = db.query(Job).count()
    total_resumes = db.query(Resume).count()
    total_applications = db.query(Application).count()

    # Average ATS score across all scored applications
    avg_row = db.query(func.avg(Application.ats_score)).filter(
        Application.ats_score.isnot(None)
    ).scalar()
    avg_ats_score = round(float(avg_row), 1) if avg_row else 0.0

    # Pipeline counts
    scored_count = db.query(Application).filter(
        Application.ats_score.isnot(None)
    ).count()
    approved_count = db.query(Application).filter(
        Application.human_approved == True
    ).count()
    applied_count = db.query(Application).filter(
        Application.status == ApplicationStatus.submitted
    ).count()

    # ATS score distribution
    dist = {"0-20": 0, "20-40": 0, "40-60": 0, "60-80": 0, "80-100": 0}
    scored_apps = db.query(Application.ats_score).filter(
        Application.ats_score.isnot(None)
    ).all()
    for (score,) in scored_apps:
        if score < 20:      dist["0-20"] += 1
        elif score < 40:    dist["20-40"] += 1
        elif score < 60:    dist["40-60"] += 1
        elif score < 80:    dist["60-80"] += 1
        else:               dist["80-100"] += 1

    # Job type breakdown
    from models import JobType as JT
    breakdown = {}
    for jt in JT:
        breakdown[jt.value] = db.query(Job).filter(Job.job_type == jt).count()

    # Recent applications (last 10) with nested job/resume info
    recent = (
        db.query(Application)
        .order_by(Application.created_at.desc())
        .limit(10)
        .all()
    )

    def _app_dict(a: Application):
        job = db.query(Job).filter(Job.id == a.job_id).first()
        resume = db.query(Resume).filter(Resume.id == a.resume_id).first()
        return {
            "id": a.id,
            "job_id": a.job_id,
            "resume_id": a.resume_id,
            "status": a.status.value if hasattr(a.status, "value") else a.status,
            "ats_score": a.ats_score,
            "human_approved": a.human_approved,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "applied_at": a.applied_at.isoformat() if a.applied_at else None,
            "job": {
                "id": job.id,
                "title": job.title,
                "company": job.company,
                "job_type": job.job_type.value if hasattr(job.job_type, "value") else job.job_type,
                "url": job.url,
            } if job else None,
            "resume": {
                "id": resume.id,
                "filename": resume.filename,
                "category": resume.category.value if hasattr(resume.category, "value") else resume.category,
            } if resume else None,
        }

    return {
        "total_jobs": total_jobs,
        "total_resumes": total_resumes,
        "total_applications": total_applications,
        "avg_ats_score": avg_ats_score,
        "pipeline": {
            "found": total_jobs,
            "scored": scored_count,
            "approved": approved_count,
            "applied": applied_count,
        },
        "ats_distribution": dist,
        "job_type_breakdown": breakdown,
        "recent_applications": [_app_dict(a) for a in recent],
    }


@app.get("/health", tags=["health"])
def health_check():
    """Simple liveness probe."""
    return {
        "status": "ok",
        "service": "Job Application Pipeline API",
    }


@app.get("/", tags=["root"])
def root():
    """Root endpoint – redirects consumers to the API docs."""
    return {
        "message": "Job Application Pipeline API",
        "docs": "/docs",
        "health": "/health",
    }
