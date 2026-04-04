"""
Site monitoring service for the Job Application Pipeline Dashboard.

Periodically checks tracked career sites for new job listings, persists new
jobs to the Job table, and writes a SiteCheckLog entry for every run.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Job
from models_history import SiteCheckLog, TrackedSite
from services.job_scraper import determine_job_type

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared HTTP settings
# ---------------------------------------------------------------------------

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
}

_SITE_TIMEOUT = httpx.Timeout(15.0, connect=10.0)

# Keywords that suggest an <a> tag links to a job listing
_JOB_LINK_KEYWORDS = [
    "job", "career", "position", "role", "opening", "opportunity",
    "engineer", "developer", "analyst", "scientist", "manager",
    "director", "intern", "associate", "specialist", "consultant",
    "apply", "requisition", "posting",
]


# ---------------------------------------------------------------------------
# Interval helpers
# ---------------------------------------------------------------------------

def get_interval_label(hours: int) -> str:
    """Return a human-readable string for a polling interval in hours."""
    labels = {
        24:  "Every day",
        48:  "Every 2 days",
        72:  "Every 3 days",
        168: "Every week",
        336: "Every 2 weeks",
        720: "Every month",
    }
    return labels.get(hours, f"Every {hours} hours")


def schedule_next_check(site: TrackedSite) -> None:
    """
    Set site.next_check_at = utcnow() + interval_hours.
    Call this after a check completes (last_checked_at should already be set).
    """
    site.next_check_at = datetime.utcnow() + timedelta(hours=site.interval_hours)


# ---------------------------------------------------------------------------
# HTML job-link extractor
# ---------------------------------------------------------------------------

def _extract_job_links(html: str, base_url: str) -> list[dict]:
    """
    Parse raw HTML and return up to 20 job-like links.

    Each entry: {"title": str, "url": str}
    """
    soup = BeautifulSoup(html, "lxml")
    candidates: list[dict] = []

    for a_tag in soup.find_all("a", href=True):
        href: str = a_tag["href"].strip()
        text: str = a_tag.get_text(" ", strip=True)

        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue

        # Build absolute URL
        abs_url = href if href.startswith("http") else urljoin(base_url, href)

        # Check both href and anchor text for job-related keywords
        combined = (href + " " + text).lower()
        if any(kw in combined for kw in _JOB_LINK_KEYWORDS):
            candidates.append({"title": text or href, "url": abs_url})

        if len(candidates) >= 20:
            break

    # De-duplicate by URL while preserving order
    seen: set[str] = set()
    unique: list[dict] = []
    for c in candidates:
        if c["url"] not in seen:
            seen.add(c["url"])
            unique.append(c)

    return unique[:20]


# ---------------------------------------------------------------------------
# Core check logic
# ---------------------------------------------------------------------------

async def _fetch_html(url: str) -> Optional[str]:
    """Async HTTP GET; returns response text or None on failure."""
    async with httpx.AsyncClient(
        headers=_HEADERS, timeout=_SITE_TIMEOUT, follow_redirects=True
    ) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text
        except httpx.HTTPError as exc:
            logger.error("HTTP error fetching %s: %s", url, exc)
            return None


async def check_site(site: TrackedSite, db: Session) -> SiteCheckLog:
    """
    Fetch *site.url*, extract job links, compare against existing Job URLs in
    the database, save genuinely new jobs, update site statistics, and write
    a SiteCheckLog record.

    Parameters
    ----------
    site : TrackedSite
        The ORM object to check (must already be attached to *db*).
    db : Session
        Active SQLAlchemy session.

    Returns
    -------
    SiteCheckLog
        The log entry that was committed to the database.
    """
    log = SiteCheckLog(
        site_id=site.id,
        checked_at=datetime.utcnow(),
    )

    try:
        html = await _fetch_html(site.url)
        if html is None:
            log.status = "error"
            log.error_message = f"Failed to fetch {site.url}"
            log.jobs_found = 0
            log.new_jobs = 0
        else:
            job_links = _extract_job_links(html, site.url)
            log.jobs_found = len(job_links)
            log.job_titles_found = [j["title"] for j in job_links]

            # Find URLs we haven't seen before
            existing_urls: set[str] = {
                row[0]
                for row in db.query(Job.url).filter(Job.url.isnot(None)).all()
            }

            new_jobs_saved = 0
            for link in job_links:
                if link["url"] in existing_urls:
                    continue

                job_type = determine_job_type(link["title"], "")
                new_job = Job(
                    title=link["title"][:255],
                    company=site.company,
                    location="",
                    url=link["url"],
                    description="",
                    job_type=job_type,
                    created_at=datetime.utcnow(),
                )
                db.add(new_job)
                existing_urls.add(link["url"])
                new_jobs_saved += 1

            log.new_jobs = new_jobs_saved
            log.status = "success" if new_jobs_saved > 0 else "no_change"

    except Exception as exc:
        logger.exception("Unexpected error checking site %d (%s): %s", site.id, site.url, exc)
        log.status = "error"
        log.error_message = str(exc)
        log.jobs_found = 0
        log.new_jobs = 0

    # Update site tracking fields
    site.last_checked_at = datetime.utcnow()
    schedule_next_check(site)
    site.jobs_found_total = (site.jobs_found_total or 0) + log.new_jobs
    site.new_jobs_last_check = log.new_jobs

    db.add(log)
    try:
        db.commit()
        db.refresh(log)
    except Exception as exc:
        logger.error("DB commit failed after checking site %d: %s", site.id, exc)
        db.rollback()
        log.status = "error"
        log.error_message = f"DB commit failed: {exc}"

    logger.info(
        "Site check complete: site_id=%d status=%s jobs_found=%d new=%d",
        site.id,
        log.status,
        log.jobs_found,
        log.new_jobs,
    )
    return log


# ---------------------------------------------------------------------------
# Bulk scheduler helpers
# ---------------------------------------------------------------------------

async def check_all_due_sites(db: Session) -> None:
    """
    Query all active TrackedSites whose next_check_at is NULL or in the past,
    then call check_site for each one sequentially.
    """
    now = datetime.utcnow()
    due_sites = (
        db.query(TrackedSite)
        .filter(
            TrackedSite.is_active.is_(True),
            (TrackedSite.next_check_at.is_(None)) | (TrackedSite.next_check_at <= now),
        )
        .all()
    )

    if not due_sites:
        logger.debug("Scheduler: no sites due for checking at %s", now.isoformat())
        return

    logger.info("Scheduler: checking %d due site(s) at %s", len(due_sites), now.isoformat())

    for site in due_sites:
        try:
            log = await check_site(site, db)
            logger.info(
                "Scheduler: site_id=%d (%s) -> status=%s new_jobs=%d",
                site.id,
                site.name,
                log.status,
                log.new_jobs,
            )
        except Exception as exc:
            logger.error(
                "Scheduler: unhandled exception for site_id=%d: %s", site.id, exc
            )


async def run_scheduler_loop() -> None:
    """
    Infinite async loop that fires check_all_due_sites every 30 minutes.
    Intended to be started as a FastAPI background task at application startup.
    """
    logger.info("Site-monitor scheduler started (interval: 30 min).")
    while True:
        db: Session = SessionLocal()
        try:
            await check_all_due_sites(db)
        except Exception as exc:
            logger.error("Scheduler loop error: %s", exc)
        finally:
            db.close()

        await asyncio.sleep(30 * 60)  # 30 minutes
