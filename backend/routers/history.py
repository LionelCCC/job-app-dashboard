"""
FastAPI router for the Site Monitoring / History feature.
Prefix: /api/history
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, HttpUrl
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models_history import SiteCheckLog, TrackedSite
from services.site_monitor import check_site, get_interval_label, schedule_next_check

logger = logging.getLogger(__name__)

router = APIRouter(tags=["history"])

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class TrackedSiteCreate(BaseModel):
    url: str
    name: str
    company: str
    notes: Optional[str] = None
    interval_hours: int = 24


class TrackedSiteUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    interval_hours: Optional[int] = None
    is_active: Optional[bool] = None


class RecentLogOut(BaseModel):
    checked_at: datetime
    jobs_found: int
    new_jobs: int
    status: str

    class Config:
        from_attributes = True


class TrackedSiteOut(BaseModel):
    id: int
    name: str
    url: str
    company: str
    notes: Optional[str]
    interval_hours: int
    interval_label: str
    is_active: bool
    last_checked_at: Optional[datetime]
    next_check_at: Optional[datetime]
    jobs_found_total: int
    new_jobs_last_check: int
    created_at: datetime
    recent_logs: list[RecentLogOut]

    class Config:
        from_attributes = True


class SiteCheckLogOut(BaseModel):
    id: int
    site_id: int
    checked_at: datetime
    jobs_found: int
    new_jobs: int
    status: str
    error_message: Optional[str]
    job_titles_found: Optional[list[str]]

    class Config:
        from_attributes = True


class StatsOut(BaseModel):
    total_sites: int
    active_sites: int
    total_checks_run: int
    total_jobs_found: int
    sites_due_now: int
    next_scheduled: Optional[datetime]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_HTTP_VALIDATE_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}


async def _is_url_reachable(url: str) -> bool:
    """Return True if the URL responds with a non-5xx status within 10 s."""
    async with httpx.AsyncClient(
        headers=_HEADERS, timeout=_HTTP_VALIDATE_TIMEOUT, follow_redirects=True
    ) as client:
        try:
            resp = await client.head(url)
            return resp.status_code < 500
        except httpx.HTTPError:
            # Some servers reject HEAD – fall back to GET
            try:
                resp = await client.get(url)
                return resp.status_code < 500
            except httpx.HTTPError:
                return False


def _build_site_out(site: TrackedSite) -> TrackedSiteOut:
    """Assemble a TrackedSiteOut including the 3 most recent logs."""
    recent = sorted(site.check_logs, key=lambda l: l.checked_at, reverse=True)[:3]
    return TrackedSiteOut(
        id=site.id,
        name=site.name,
        url=site.url,
        company=site.company,
        notes=site.notes,
        interval_hours=site.interval_hours,
        interval_label=get_interval_label(site.interval_hours),
        is_active=site.is_active,
        last_checked_at=site.last_checked_at,
        next_check_at=site.next_check_at,
        jobs_found_total=site.jobs_found_total,
        new_jobs_last_check=site.new_jobs_last_check,
        created_at=site.created_at,
        recent_logs=[
            RecentLogOut(
                checked_at=l.checked_at,
                jobs_found=l.jobs_found,
                new_jobs=l.new_jobs,
                status=l.status,
            )
            for l in recent
        ],
    )


# ---------------------------------------------------------------------------
# GET /api/history/stats   (must be declared BEFORE /{id} to avoid conflict)
# ---------------------------------------------------------------------------


@router.get("/stats", response_model=StatsOut, summary="Aggregate monitoring statistics")
def get_stats(db: Session = Depends(get_db)) -> StatsOut:
    """
    Return high-level statistics about tracked sites and check history.
    """
    total_sites: int = db.query(func.count(TrackedSite.id)).scalar() or 0
    active_sites: int = (
        db.query(func.count(TrackedSite.id))
        .filter(TrackedSite.is_active.is_(True))
        .scalar()
        or 0
    )
    total_checks_run: int = db.query(func.count(SiteCheckLog.id)).scalar() or 0
    total_jobs_found: int = (
        db.query(func.sum(SiteCheckLog.new_jobs)).scalar() or 0
    )

    now = datetime.utcnow()
    sites_due_now: int = (
        db.query(func.count(TrackedSite.id))
        .filter(
            TrackedSite.is_active.is_(True),
            (TrackedSite.next_check_at.is_(None)) | (TrackedSite.next_check_at <= now),
        )
        .scalar()
        or 0
    )

    # Next scheduled = earliest future next_check_at among active sites
    next_row = (
        db.query(func.min(TrackedSite.next_check_at))
        .filter(
            TrackedSite.is_active.is_(True),
            TrackedSite.next_check_at > now,
        )
        .scalar()
    )

    return StatsOut(
        total_sites=total_sites,
        active_sites=active_sites,
        total_checks_run=total_checks_run,
        total_jobs_found=int(total_jobs_found),
        sites_due_now=sites_due_now,
        next_scheduled=next_row,
    )


# ---------------------------------------------------------------------------
# GET /api/history/
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[TrackedSiteOut], summary="List all tracked sites")
def list_tracked_sites(db: Session = Depends(get_db)) -> list[TrackedSiteOut]:
    """
    Return all tracked sites sorted by next_check_at ASC (NULL last),
    each with its 3 most recent check logs.
    """
    from sqlalchemy import nulls_last, asc

    sites = (
        db.query(TrackedSite)
        .order_by(nulls_last(asc(TrackedSite.next_check_at)))
        .all()
    )
    return [_build_site_out(s) for s in sites]


# ---------------------------------------------------------------------------
# POST /api/history/
# ---------------------------------------------------------------------------


@router.post("/", response_model=TrackedSiteOut, status_code=201, summary="Add a tracked site")
async def create_tracked_site(
    body: TrackedSiteCreate, db: Session = Depends(get_db)
) -> TrackedSiteOut:
    """
    Register a new URL for periodic monitoring.

    Validates that the URL is reachable before saving; sets next_check_at
    to now + interval_hours.
    """
    if not await _is_url_reachable(body.url):
        raise HTTPException(
            status_code=422,
            detail=f"URL is not reachable: {body.url}",
        )

    now = datetime.utcnow()
    site = TrackedSite(
        name=body.name,
        url=body.url,
        company=body.company,
        notes=body.notes,
        interval_hours=body.interval_hours,
        is_active=True,
        next_check_at=now + timedelta(hours=body.interval_hours),
        jobs_found_total=0,
        new_jobs_last_check=0,
        created_at=now,
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    logger.info("Created TrackedSite id=%d name=%r url=%s", site.id, site.name, site.url)
    return _build_site_out(site)


# ---------------------------------------------------------------------------
# GET /api/history/{id}
# ---------------------------------------------------------------------------


@router.get("/{site_id}", response_model=dict, summary="Get site detail with paginated logs")
def get_tracked_site(
    site_id: int,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Return full site details plus ALL check logs, paginated (20/page by default),
    newest first.
    """
    site = db.query(TrackedSite).filter(TrackedSite.id == site_id).first()
    if site is None:
        raise HTTPException(status_code=404, detail=f"Tracked site {site_id} not found")

    total_logs: int = (
        db.query(func.count(SiteCheckLog.id))
        .filter(SiteCheckLog.site_id == site_id)
        .scalar()
        or 0
    )
    offset = (page - 1) * page_size
    logs = (
        db.query(SiteCheckLog)
        .filter(SiteCheckLog.site_id == site_id)
        .order_by(SiteCheckLog.checked_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return {
        "site": _build_site_out(site),
        "logs": [
            SiteCheckLogOut.model_validate(l).model_dump() for l in logs
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total_logs,
            "total_pages": max(1, (total_logs + page_size - 1) // page_size),
        },
    }


# ---------------------------------------------------------------------------
# PUT /api/history/{id}
# ---------------------------------------------------------------------------


@router.put("/{site_id}", response_model=TrackedSiteOut, summary="Update a tracked site")
def update_tracked_site(
    site_id: int,
    body: TrackedSiteUpdate,
    db: Session = Depends(get_db),
) -> TrackedSiteOut:
    """
    Update name, notes, interval_hours, or is_active.

    If interval_hours changes, recalculate next_check_at:
    - from last_checked_at if the site has been checked at least once
    - otherwise from now
    """
    site = db.query(TrackedSite).filter(TrackedSite.id == site_id).first()
    if site is None:
        raise HTTPException(status_code=404, detail=f"Tracked site {site_id} not found")

    interval_changed = (
        body.interval_hours is not None and body.interval_hours != site.interval_hours
    )

    if body.name is not None:
        site.name = body.name
    if body.notes is not None:
        site.notes = body.notes
    if body.is_active is not None:
        site.is_active = body.is_active
    if body.interval_hours is not None:
        site.interval_hours = body.interval_hours

    if interval_changed:
        base_dt = site.last_checked_at or datetime.utcnow()
        site.next_check_at = base_dt + timedelta(hours=site.interval_hours)

    db.commit()
    db.refresh(site)
    logger.info("Updated TrackedSite id=%d", site.id)
    return _build_site_out(site)


# ---------------------------------------------------------------------------
# DELETE /api/history/{id}
# ---------------------------------------------------------------------------


@router.delete("/{site_id}", status_code=204, summary="Delete a tracked site and its logs")
def delete_tracked_site(site_id: int, db: Session = Depends(get_db)) -> None:
    """
    Permanently delete a tracked site and all associated SiteCheckLog rows.
    The cascade is handled by the FK constraint (ondelete=CASCADE).
    """
    site = db.query(TrackedSite).filter(TrackedSite.id == site_id).first()
    if site is None:
        raise HTTPException(status_code=404, detail=f"Tracked site {site_id} not found")

    db.delete(site)
    db.commit()
    logger.info("Deleted TrackedSite id=%d", site_id)


# ---------------------------------------------------------------------------
# POST /api/history/{id}/check-now
# ---------------------------------------------------------------------------


@router.post(
    "/{site_id}/check-now",
    summary="Trigger an immediate synchronous check for a site",
)
async def trigger_check_now(
    site_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Run an immediate check for the given site and return the result.

    Runs synchronously so the caller gets back actual data:
    - status: "success" | "error" | "no_change"
    - jobs_found: total job links found
    - new_jobs: newly saved job records
    - job_titles_found: list of job titles (may be empty if site uses JS rendering)
    - error_message: human-readable error if status == "error"
    """
    site = db.query(TrackedSite).filter(TrackedSite.id == site_id).first()
    if site is None:
        raise HTTPException(status_code=404, detail=f"Tracked site {site_id} not found")

    try:
        log = await check_site(site, db)
        db.refresh(site)
        logger.info(
            "check-now for site_id=%d: status=%s jobs_found=%d new_jobs=%d",
            site_id, log.status, log.jobs_found, log.new_jobs,
        )
        return {
            "status": log.status or "success",
            "site_id": site_id,
            "jobs_found": log.jobs_found or 0,
            "new_jobs": log.new_jobs or 0,
            "job_titles_found": log.job_titles_found or [],
            "error_message": log.error_message,
        }
    except Exception as exc:
        logger.error("check-now failed for site_id=%d: %s", site_id, exc)
        return {
            "status": "error",
            "site_id": site_id,
            "jobs_found": 0,
            "new_jobs": 0,
            "job_titles_found": [],
            "error_message": str(exc)[:300],
        }


# ---------------------------------------------------------------------------
# GET /api/history/{id}/logs  (paginated logs for a specific site)
# ---------------------------------------------------------------------------


@router.get(
    "/{site_id}/logs",
    response_model=dict,
    summary="Paginated check logs for a site",
)
def get_site_logs(
    site_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Return paginated SiteCheckLog entries for *site_id*, newest first.
    """
    site = db.query(TrackedSite).filter(TrackedSite.id == site_id).first()
    if site is None:
        raise HTTPException(status_code=404, detail=f"Tracked site {site_id} not found")

    total: int = (
        db.query(func.count(SiteCheckLog.id))
        .filter(SiteCheckLog.site_id == site_id)
        .scalar()
        or 0
    )
    offset = (page - 1) * page_size
    logs = (
        db.query(SiteCheckLog)
        .filter(SiteCheckLog.site_id == site_id)
        .order_by(SiteCheckLog.checked_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return {
        "site_id": site_id,
        "logs": [SiteCheckLogOut.model_validate(l).model_dump() for l in logs],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        },
    }
