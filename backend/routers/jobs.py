"""
FastAPI router for job management endpoints.
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Job, JobStatus, JobType
from services.job_scraper import (
    scrape_company_job_board,
    determine_job_type,
    search_indeed_jobs,
    search_linkedin_jobs,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class JobResponse(BaseModel):
    id: int
    title: str
    company: str
    location: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    job_type: str
    salary_range: Optional[str] = None
    posted_date: Optional[datetime] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class JobStatusUpdate(BaseModel):
    status: JobStatus


class JobSearchRequest(BaseModel):
    keywords: str = ""                             # optional — blank = search all recent
    location: str = "Remote"
    job_types: list[str] = []
    sources: list[str] = ["linkedin", "indeed"]   # backend expects lowercase


class AddJobUrlRequest(BaseModel):
    url: str


# Mapping from any casing the frontend might send → canonical backend name
_SOURCE_ALIASES: dict[str, str] = {
    "linkedin": "linkedin",
    "LinkedIn": "linkedin",
    "indeed": "indeed",
    "Indeed": "indeed",
}

# Sources that are not supported for keyword search
_UNSUPPORTED_SOURCES = {"company boards", "company_boards", "companyboards"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _job_to_response(job: Job) -> JobResponse:
    return JobResponse(
        id=job.id,
        title=job.title,
        company=job.company,
        location=job.location,
        url=job.url,
        description=job.description,
        job_type=job.job_type.value if job.job_type else "SWE",
        salary_range=job.salary_range,
        posted_date=job.posted_date,
        status=job.status.value if job.status else "new",
        created_at=job.created_at,
    )


def _save_jobs_to_db(jobs: list[dict], db: Session) -> list[Job]:
    """
    Save a list of raw job dicts (from scrapers) to the database.
    Deduplicates by URL; updates existing record if URL matches.
    """
    saved: list[Job] = []
    for jd in jobs:
        url = jd.get("url", "")
        existing = db.query(Job).filter(Job.url == url).first() if url else None
        if existing:
            existing.title = jd.get("title", existing.title)
            existing.company = jd.get("company", existing.company)
            existing.location = jd.get("location", existing.location)
            existing.description = jd.get("description", existing.description)
            existing.salary_range = jd.get("salary_range", existing.salary_range)
            db.add(existing)
            saved.append(existing)
        else:
            job_type_str = jd.get("job_type", "SWE")
            try:
                job_type_enum = JobType(job_type_str)
            except ValueError:
                job_type_enum = JobType.SWE

            new_job = Job(
                title=jd.get("title", ""),
                company=jd.get("company", ""),
                location=jd.get("location", ""),
                url=url,
                description=jd.get("description", ""),
                job_type=job_type_enum,
                salary_range=jd.get("salary_range", ""),
                posted_date=jd.get("posted_date"),
                status=JobStatus.new,
            )
            db.add(new_job)
            saved.append(new_job)

    db.commit()
    for job in saved:
        db.refresh(job)
    return saved


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=dict)
def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List all jobs with optional filtering and pagination."""
    query = db.query(Job)

    if status:
        try:
            status_enum = JobStatus(status)
            query = query.filter(Job.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    if job_type:
        try:
            jt_enum = JobType(job_type)
            query = query.filter(Job.job_type == jt_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid job_type: {job_type}")

    total = query.count()
    jobs = (
        query.order_by(Job.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "jobs": [_job_to_response(j) for j in jobs],
    }


@router.post("/search", response_model=dict)
def search_jobs(request: JobSearchRequest, db: Session = Depends(get_db)):
    """
    Trigger a job search across configured sources and store results.

    Sources are normalized to lowercase. Unsupported sources (e.g. "Company Boards")
    are skipped with a human-readable error message in the response.
    keywords is optional — empty string means "search general tech roles".
    """
    all_raw: list[dict] = []
    errors: list[str] = []

    for raw_source in request.sources:
        # Normalize source name
        source_lower = raw_source.strip().lower()

        # Check for explicitly unsupported
        if source_lower in _UNSUPPORTED_SOURCES:
            errors.append(
                f'"{raw_source}" cannot be searched by keyword. '
                "Use POST /jobs/add-url to add individual postings from company careers pages."
            )
            continue

        # Resolve alias
        canonical = _SOURCE_ALIASES.get(raw_source) or _SOURCE_ALIASES.get(source_lower)
        if not canonical:
            errors.append(
                f'"{raw_source}" is an unrecognized source. '
                "Supported sources: linkedin, indeed."
            )
            continue

        try:
            if canonical == "indeed":
                results = search_indeed_jobs(
                    request.keywords or "software engineer",
                    request.location,
                    request.job_types,
                )
                all_raw.extend(results)
                logger.info("Indeed: %d results", len(results))

            elif canonical == "linkedin":
                results = search_linkedin_jobs(
                    request.keywords or "software engineer",
                    request.location,
                )
                all_raw.extend(results)
                logger.info("LinkedIn: %d results", len(results))

        except Exception as exc:
            error_msg = str(exc)
            logger.error("Search failed for source %r: %s", canonical, error_msg)
            # Provide human-readable explanation for common failures
            if "429" in error_msg or "rate" in error_msg.lower():
                errors.append(
                    f"{canonical.title()} rate-limited this request. "
                    "Wait a few minutes and try again."
                )
            elif "403" in error_msg or "blocked" in error_msg.lower():
                errors.append(
                    f"{canonical.title()} blocked the scraping request. "
                    "This is expected occasionally — try adding jobs by URL instead."
                )
            else:
                errors.append(
                    f"{canonical.title()} search failed: {error_msg[:120]}"
                )

    # Filter by requested job types if specified
    if request.job_types:
        all_raw = [
            j for j in all_raw
            if j.get("job_type") in request.job_types
        ]

    saved = _save_jobs_to_db(all_raw, db)

    return {
        "scraped": len(all_raw),
        "saved": len(saved),
        "jobs": [_job_to_response(j) for j in saved],
        "errors": errors,
    }


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    """Return a single job by ID."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return _job_to_response(job)


@router.delete("/{job_id}", response_model=dict)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    """Delete a job by ID."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    db.delete(job)
    db.commit()
    return {"deleted": job_id}


@router.post("/add-url", response_model=JobResponse)
def add_job_url(request: AddJobUrlRequest, db: Session = Depends(get_db)):
    """
    Add a specific job URL manually.
    Scrapes the page to extract title, company, description, and location.
    Works with Greenhouse, Lever, Workday, LinkedIn, Indeed, and most ATS platforms.
    """
    # Check for duplicate first
    existing = db.query(Job).filter(Job.url == request.url).first()
    if existing:
        return _job_to_response(existing)

    try:
        details = scrape_company_job_board(request.url)
    except Exception as exc:
        logger.error("Failed to scrape %s: %s", request.url, exc)
        raise HTTPException(
            status_code=422,
            detail=f"Could not scrape job from URL: {exc}. "
                   "Make sure the URL points to a public job posting page.",
        )

    jt_str = determine_job_type(
        details.get("title", ""), details.get("description", "")
    )
    try:
        job_type_enum = JobType(jt_str)
    except ValueError:
        job_type_enum = JobType.SWE

    job = Job(
        title=details.get("title", "Unknown Title"),
        company=details.get("company", "Unknown Company"),
        location=details.get("location", ""),
        url=request.url,
        description=details.get("description", ""),
        job_type=job_type_enum,
        salary_range=details.get("salary_range", ""),
        status=JobStatus.new,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


@router.put("/{job_id}/status", response_model=JobResponse)
def update_job_status(
    job_id: int,
    body: JobStatusUpdate,
    db: Session = Depends(get_db),
):
    """Update a job's status."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    job.status = body.status
    db.commit()
    db.refresh(job)
    return _job_to_response(job)
