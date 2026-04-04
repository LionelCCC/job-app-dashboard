"""
Job scraper service for the Job Application Pipeline Dashboard.
Scrapes job listings from Indeed, LinkedIn, and company job boards.
"""

import re
import logging
from typing import Optional
from urllib.parse import urljoin, urlencode, quote_plus

import httpx
from bs4 import BeautifulSoup

# anthropic imported per spec (not used in this module)
import anthropic  # noqa: F401

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared HTTP helpers
# ---------------------------------------------------------------------------

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


def _get(url: str, params: Optional[dict] = None) -> httpx.Response:
    """Synchronous GET with shared headers and timeout."""
    with httpx.Client(headers=_HEADERS, timeout=_TIMEOUT, follow_redirects=True) as client:
        return client.get(url, params=params)


# ---------------------------------------------------------------------------
# Indeed scraper
# ---------------------------------------------------------------------------

def search_indeed_jobs(query: str, location: str, job_types: list) -> list[dict]:
    """
    Scrape Indeed job listings for the given query and location.

    Parameters
    ----------
    query : str
        Job title / keyword string (e.g. "data engineer").
    location : str
        Location string (e.g. "San Francisco, CA").
    job_types : list
        List of job-type strings used to label results (not sent to Indeed
        because Indeed uses its own classification).

    Returns
    -------
    list[dict]
        Each dict has: title, company, location, url, description, salary_range.
    """
    jobs: list[dict] = []

    params = {
        "q": query,
        "l": location,
        "sort": "date",
        "limit": "25",
    }
    base_url = "https://www.indeed.com/jobs"

    try:
        resp = _get(base_url, params=params)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Indeed request failed: %s", exc)
        return jobs

    soup = BeautifulSoup(resp.text, "lxml")

    # Indeed renders job cards with data-jk attribute (job key)
    job_cards = soup.select("div[data-jk]")
    if not job_cards:
        # Fallback selector used in some A/B layouts
        job_cards = soup.select("li.css-1ac2h1w")

    for card in job_cards:
        try:
            title_el = card.select_one("h2.jobTitle span[title]") or card.select_one("h2.jobTitle")
            title = title_el.get_text(strip=True) if title_el else "Unknown Title"

            company_el = card.select_one("span.companyName") or card.select_one("[data-testid='company-name']")
            company = company_el.get_text(strip=True) if company_el else "Unknown Company"

            loc_el = card.select_one("div.companyLocation") or card.select_one("[data-testid='text-location']")
            loc = loc_el.get_text(strip=True) if loc_el else location

            job_key = card.get("data-jk", "")
            job_url = f"https://www.indeed.com/viewjob?jk={job_key}" if job_key else ""

            snippet_el = card.select_one("div.job-snippet") or card.select_one("ul.jobsearch-ResultsList")
            description = snippet_el.get_text(" ", strip=True) if snippet_el else ""

            salary_el = card.select_one("div.salary-snippet-container") or card.select_one(
                "div.metadata.salary-snippet-container"
            )
            salary_range = salary_el.get_text(strip=True) if salary_el else ""

            if title == "Unknown Title" and not job_key:
                continue  # skip malformed cards

            jobs.append(
                {
                    "title": title,
                    "company": company,
                    "location": loc,
                    "url": job_url,
                    "description": description,
                    "salary_range": salary_range,
                    "job_type": determine_job_type(title, description),
                }
            )
        except Exception as exc:
            logger.warning("Failed to parse an Indeed job card: %s", exc)
            continue

    logger.info("Indeed: scraped %d jobs for query=%r location=%r", len(jobs), query, location)
    return jobs


# ---------------------------------------------------------------------------
# LinkedIn scraper (public, no auth)
# ---------------------------------------------------------------------------

def search_linkedin_jobs(query: str, location: str) -> list[dict]:
    """
    Scrape LinkedIn public job search (no authentication required).

    Returns
    -------
    list[dict]
        Each dict has: title, company, location, url, description, salary_range.
    """
    jobs: list[dict] = []

    params = {
        "keywords": query,
        "location": location,
        "f_TPR": "r86400",   # posted in last 24 hours
        "start": "0",
    }
    base_url = "https://www.linkedin.com/jobs/search/"

    try:
        resp = _get(base_url, params=params)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("LinkedIn request failed: %s", exc)
        return jobs

    soup = BeautifulSoup(resp.text, "lxml")

    job_cards = soup.select("div.base-card")
    if not job_cards:
        job_cards = soup.select("li.jobs-search__results-list-item")

    for card in job_cards:
        try:
            title_el = card.select_one("h3.base-search-card__title") or card.select_one(
                "span.screen-reader-text"
            )
            title = title_el.get_text(strip=True) if title_el else "Unknown Title"

            company_el = card.select_one("h4.base-search-card__subtitle") or card.select_one(
                "a.hidden-nested-link"
            )
            company = company_el.get_text(strip=True) if company_el else "Unknown Company"

            loc_el = card.select_one("span.job-search-card__location")
            loc = loc_el.get_text(strip=True) if loc_el else location

            link_el = card.select_one("a.base-card__full-link") or card.select_one("a[href*='/jobs/view/']")
            job_url = link_el["href"].split("?")[0] if link_el and link_el.get("href") else ""

            snippet_el = card.select_one("p.job-search-card__snippet")
            description = snippet_el.get_text(strip=True) if snippet_el else ""

            jobs.append(
                {
                    "title": title,
                    "company": company,
                    "location": loc,
                    "url": job_url,
                    "description": description,
                    "salary_range": "",
                    "job_type": determine_job_type(title, description),
                }
            )
        except Exception as exc:
            logger.warning("Failed to parse a LinkedIn job card: %s", exc)
            continue

    logger.info("LinkedIn: scraped %d jobs for query=%r location=%r", len(jobs), query, location)
    return jobs


# ---------------------------------------------------------------------------
# Generic company job board scraper
# ---------------------------------------------------------------------------

def scrape_company_job_board(url: str) -> dict:
    """
    Given a specific job posting URL (e.g. Google Careers, Greenhouse, Lever),
    fetch the page and extract job details.

    Returns
    -------
    dict
        Keys: title, company, description, apply_link, location, salary_range.
        Empty strings for fields that cannot be found.
    """
    result: dict = {
        "title": "",
        "company": "",
        "description": "",
        "apply_link": "",
        "location": "",
        "salary_range": "",
    }

    try:
        resp = _get(url)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Company job board fetch failed for %s: %s", url, exc)
        return result

    soup = BeautifulSoup(resp.text, "lxml")

    # --- Title ---
    for selector in [
        "h1.posting-headline",          # Lever
        "h1.app-title",                 # Greenhouse
        "h1[data-automation='job-title']",  # Workday
        "h1.jobsearch-JobInfoHeader-title",  # Indeed single job page
        "h1",
    ]:
        el = soup.select_one(selector)
        if el:
            result["title"] = el.get_text(strip=True)
            break

    # --- Company ---
    for selector in [
        "div.posting-header .company-name",
        "span.company-name",
        "a.employer-name",
        "meta[property='og:site_name']",
    ]:
        el = soup.select_one(selector)
        if el:
            result["company"] = el.get("content", "") or el.get_text(strip=True)
            break

    if not result["company"]:
        # Derive from og:title as fallback
        og_title = soup.select_one("meta[property='og:title']")
        if og_title:
            result["company"] = og_title.get("content", "")

    # --- Description ---
    for selector in [
        "div#job-description",
        "div.section-wrapper",          # Lever
        "div#content",                  # Greenhouse
        "div[data-automation='jobAdDetails']",  # Seek
        "div.jobsearch-JobComponent-description",
        "article.job-description",
        "div.description",
    ]:
        el = soup.select_one(selector)
        if el:
            result["description"] = el.get_text("\n", strip=True)
            break

    if not result["description"]:
        # Fall back to <main> text
        main_el = soup.select_one("main")
        if main_el:
            result["description"] = main_el.get_text("\n", strip=True)[:5000]

    # --- Location ---
    for selector in [
        "div.location",
        "span[data-automation='job-location']",
        "span.location",
    ]:
        el = soup.select_one(selector)
        if el:
            result["location"] = el.get_text(strip=True)
            break

    # --- Apply link ---
    for selector in [
        "a#apply-button",
        "a.postings-btn",               # Lever
        "a[data-greenhouse-job-board-token]",
        "a[href*='apply']",
    ]:
        el = soup.select_one(selector)
        if el and el.get("href"):
            href = el["href"]
            result["apply_link"] = href if href.startswith("http") else urljoin(url, href)
            break

    if not result["apply_link"]:
        result["apply_link"] = url

    return result


# ---------------------------------------------------------------------------
# URL validator
# ---------------------------------------------------------------------------

def validate_application_link(url: str) -> bool:
    """
    Check whether a URL leads to an actual job application form.

    Returns True if the page returns 2xx and contains application-related
    HTML elements (form, file-upload input, or application-keywords in text).
    """
    try:
        resp = _get(url)
        if resp.status_code >= 400:
            return False
    except httpx.HTTPError:
        return False

    soup = BeautifulSoup(resp.text, "lxml")

    # Must have a form
    if soup.select("form"):
        return True

    # Or at least a file upload element
    if soup.select("input[type='file']"):
        return True

    # Or application-related keywords in a button/link
    page_text = resp.text.lower()
    application_keywords = ["apply now", "submit application", "apply for this job", "start application"]
    if any(kw in page_text for kw in application_keywords):
        return True

    return False


# ---------------------------------------------------------------------------
# Job type classifier
# ---------------------------------------------------------------------------

_JOB_TYPE_PATTERNS: dict[str, list[str]] = {
    "AIE": [
        "ai engineer", "llm", "generative ai", "gen ai", "nlp",
        "large language model", "prompt engineer", "foundation model",
        "retrieval augmented generation", "rag", "langchain", "openai",
        "hugging face", "transformer", "gpt", "ai/ml",
    ],
    "MLE": [
        "machine learning engineer", "ml engineer", "mlops", "model deployment",
        "model serving", "feature store", "kubeflow", "mlflow", "model monitoring",
        "inference", "training pipeline", "model pipeline",
    ],
    "DS": [
        "data scientist", "data science", "machine learning", "statistical",
        "statistics", "r programming", "sklearn", "scikit-learn", "tensorflow",
        "pytorch", "xgboost", "predictive model", "regression", "classification",
        "deep learning", "neural network",
    ],
    "DE": [
        "data engineer", "etl", "pipeline", "spark", "hadoop", "kafka",
        "airflow", "dbt", "data warehouse", "data lake", "databricks",
        "flink", "data pipeline", "batch processing", "stream processing",
        "bigquery", "redshift", "snowflake engineer",
    ],
    "DA": [
        "data analyst", "sql", "tableau", "power bi", "analytics",
        "business intelligence", "bi analyst", "reporting", "looker",
        "excel", "dashboard", "visualization", "metric", "kpi",
    ],
    "SWE": [
        "software engineer", "software developer", "backend", "frontend",
        "fullstack", "full stack", "full-stack", "web developer", "api",
        "microservices", "devops", "platform engineer", "site reliability",
        "sre", "cloud engineer", "infrastructure", "kubernetes", "docker",
    ],
}

# Ordered priority: more-specific types checked before broader ones
_PRIORITY_ORDER = ["AIE", "MLE", "DS", "DE", "DA", "SWE"]


def determine_job_type(title: str, description: str) -> str:
    """
    Use keyword matching to determine the job category.

    Returns one of: SWE, DE, DA, DS, MLE, AIE.
    Defaults to SWE if no pattern matches.
    """
    combined = (title + " " + description).lower()

    scores: dict[str, int] = {jt: 0 for jt in _PRIORITY_ORDER}

    for job_type, keywords in _JOB_TYPE_PATTERNS.items():
        for kw in keywords:
            if kw in combined:
                scores[job_type] += 1

    # Pick the highest-scoring category, respecting priority order for ties
    best_type = "SWE"
    best_score = 0
    for jt in _PRIORITY_ORDER:
        if scores[jt] > best_score:
            best_score = scores[jt]
            best_type = jt

    return best_type
