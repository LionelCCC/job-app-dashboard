"""
Auto-apply service for the Job Application Pipeline Dashboard.
Uses Playwright to fill and (optionally) submit job application forms.
"""

import asyncio
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Playwright is optional so the rest of the app still starts if it's missing
try:
    from playwright.async_api import async_playwright, Page, Browser
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False
    logger.warning("Playwright is not installed – auto-apply disabled. Run: playwright install")

SCREENSHOTS_DIR = Path("/Users/lionelc/Job app dashboard/backend/screenshots")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------

def detect_application_platform(url: str) -> str:
    """
    Detect the ATS platform from the URL.

    Returns one of: greenhouse, lever, workday, linkedin, indeed, custom
    """
    url_lower = url.lower()
    if "greenhouse.io" in url_lower or "boards.greenhouse.io" in url_lower:
        return "greenhouse"
    if "lever.co" in url_lower or "jobs.lever.co" in url_lower:
        return "lever"
    if "workday.com" in url_lower or "myworkdayjobs.com" in url_lower:
        return "workday"
    if "linkedin.com/jobs" in url_lower or "easyapply" in url_lower:
        return "linkedin"
    if "indeed.com" in url_lower or "indeed.apply" in url_lower:
        return "indeed"
    return "custom"


# ---------------------------------------------------------------------------
# Platform-specific form fillers
# ---------------------------------------------------------------------------

async def fill_greenhouse_form(page: "Page", resume_data: dict) -> list[str]:
    """
    Fill a Greenhouse application form.
    Returns a list of field names that were filled successfully.
    """
    contact = resume_data.get("contact_info", {})
    filled: list[str] = []

    field_map = {
        "#first_name": contact.get("name", "").split()[0] if contact.get("name") else "",
        "#last_name": " ".join(contact.get("name", "").split()[1:]) if contact.get("name") else "",
        "#email": contact.get("email", ""),
        "#phone": contact.get("phone", ""),
        "input[name='job_application[linkedin_profile_url]']": contact.get("linkedin", ""),
        "input[name='job_application[website]']": contact.get("github", ""),
    }

    for selector, value in field_map.items():
        if not value:
            continue
        try:
            el = await page.query_selector(selector)
            if el:
                await el.fill(str(value))
                filled.append(selector)
        except Exception as exc:
            logger.warning("Greenhouse: could not fill %s: %s", selector, exc)

    return filled


async def fill_lever_form(page: "Page", resume_data: dict) -> list[str]:
    """
    Fill a Lever application form.
    Returns a list of field names that were filled successfully.
    """
    contact = resume_data.get("contact_info", {})
    filled: list[str] = []

    field_map = {
        "input[name='name']": contact.get("name", ""),
        "input[name='email']": contact.get("email", ""),
        "input[name='phone']": contact.get("phone", ""),
        "input[name='urls[LinkedIn]']": contact.get("linkedin", ""),
        "input[name='urls[GitHub]']": contact.get("github", ""),
    }

    for selector, value in field_map.items():
        if not value:
            continue
        try:
            el = await page.query_selector(selector)
            if el:
                await el.fill(str(value))
                filled.append(selector)
        except Exception as exc:
            logger.warning("Lever: could not fill %s: %s", selector, exc)

    return filled


async def fill_workday_form(page: "Page", resume_data: dict) -> list[str]:
    """
    Fill a Workday application form (basic fields).
    Workday uses heavy JavaScript so this handles common auto-fill selectors.
    """
    contact = resume_data.get("contact_info", {})
    filled: list[str] = []

    # Workday uses data-automation attributes
    field_map = {
        "[data-automation-id='legalNameSection_firstName']": (
            contact.get("name", "").split()[0] if contact.get("name") else ""
        ),
        "[data-automation-id='legalNameSection_lastName']": (
            " ".join(contact.get("name", "").split()[1:]) if contact.get("name") else ""
        ),
        "[data-automation-id='email']": contact.get("email", ""),
        "[data-automation-id='phone-number']": contact.get("phone", ""),
    }

    for selector, value in field_map.items():
        if not value:
            continue
        try:
            el = await page.query_selector(selector)
            if el:
                await el.fill(str(value))
                filled.append(selector)
        except Exception as exc:
            logger.warning("Workday: could not fill %s: %s", selector, exc)

    return filled


# ---------------------------------------------------------------------------
# Generic form filler
# ---------------------------------------------------------------------------

_GENERIC_FIELD_SELECTORS = [
    # name
    ("name", ["input[name='name']", "input[id*='name']", "input[placeholder*='name' i]"]),
    ("first_name", ["input[name='first_name']", "input[id*='first' i]", "input[placeholder*='first' i]"]),
    ("last_name", ["input[name='last_name']", "input[id*='last' i]", "input[placeholder*='last' i]"]),
    # contact
    ("email", ["input[type='email']", "input[name='email']", "input[id*='email' i]"]),
    ("phone", ["input[type='tel']", "input[name='phone']", "input[id*='phone' i]"]),
    ("linkedin", ["input[name*='linkedin' i]", "input[id*='linkedin' i]", "input[placeholder*='linkedin' i]"]),
    ("github", ["input[name*='github' i]", "input[id*='github' i]", "input[placeholder*='github' i]"]),
]


async def _fill_generic_form(page: "Page", resume_data: dict) -> list[str]:
    contact = resume_data.get("contact_info", {})
    name_parts = (contact.get("name") or "").split(maxsplit=1)
    first_name = name_parts[0] if name_parts else ""
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    values = {
        "name": contact.get("name", ""),
        "first_name": first_name,
        "last_name": last_name,
        "email": contact.get("email", ""),
        "phone": contact.get("phone", ""),
        "linkedin": contact.get("linkedin", ""),
        "github": contact.get("github", ""),
    }

    filled: list[str] = []
    for field_key, selectors in _GENERIC_FIELD_SELECTORS:
        value = values.get(field_key, "")
        if not value:
            continue
        for selector in selectors:
            try:
                el = await page.query_selector(selector)
                if el:
                    await el.fill(str(value))
                    filled.append(f"{field_key} ({selector})")
                    break
            except Exception:
                continue

    return filled


async def _upload_resume_file(page: "Page", resume_path: str) -> bool:
    """
    Attempt to upload a resume file to any file-input element on the page.
    Returns True if an upload was performed.
    """
    for selector in [
        "input[type='file']",
        "input[accept*='pdf']",
        "input[accept*='.doc']",
    ]:
        try:
            el = await page.query_selector(selector)
            if el:
                await el.set_input_files(resume_path)
                logger.info("Uploaded resume via selector: %s", selector)
                return True
        except Exception as exc:
            logger.warning("File upload via %s failed: %s", selector, exc)

    return False


# ---------------------------------------------------------------------------
# Main apply function
# ---------------------------------------------------------------------------

async def apply_to_job(
    job_url: str,
    resume_data: dict,
    edited_resume_path: Optional[str] = None,
) -> dict:
    """
    Attempt to auto-fill a job application form.

    Parameters
    ----------
    job_url : str
        URL of the job application page.
    resume_data : dict
        Parsed resume data (output of resume_parser.parse_resume()).
    edited_resume_path : str, optional
        Path to an AI-edited resume file; used for file upload if provided.

    Returns
    -------
    dict with keys:
        status: "success" | "partial" | "error"
        screenshot_path: str
        fields_filled: list[str]
        manual_fields_needed: list[str]
        error: str (only on error)
    """
    if not _PLAYWRIGHT_AVAILABLE:
        return {
            "status": "error",
            "screenshot_path": "",
            "fields_filled": [],
            "manual_fields_needed": [],
            "error": "Playwright is not installed. Run: pip install playwright && playwright install",
        }

    resume_file = edited_resume_path or resume_data.get("original_path", "")
    platform = detect_application_platform(job_url)
    fields_filled: list[str] = []
    manual_fields_needed: list[str] = []
    screenshot_path = ""
    error_message = ""

    try:
        async with async_playwright() as pw:
            browser: Browser = await pw.chromium.launch(headless=False, slow_mo=200)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()

            try:
                await page.goto(job_url, wait_until="networkidle", timeout=30_000)
            except Exception as exc:
                logger.error("Failed to navigate to %s: %s", job_url, exc)
                await browser.close()
                return {
                    "status": "error",
                    "screenshot_path": "",
                    "fields_filled": [],
                    "manual_fields_needed": [],
                    "error": f"Navigation failed: {exc}",
                }

            # Platform-specific filling
            if platform == "greenhouse":
                fields_filled = await fill_greenhouse_form(page, resume_data)
            elif platform == "lever":
                fields_filled = await fill_lever_form(page, resume_data)
            elif platform == "workday":
                fields_filled = await fill_workday_form(page, resume_data)
            else:
                fields_filled = await _fill_generic_form(page, resume_data)

            # Attempt file upload
            if resume_file and os.path.exists(resume_file):
                uploaded = await _upload_resume_file(page, resume_file)
                if uploaded:
                    fields_filled.append("resume_file")
                else:
                    manual_fields_needed.append("resume_file_upload")

            # Detect unfilled required fields
            required_unfilled = await page.eval_on_selector_all(
                "input[required]:not([type='hidden']), textarea[required], select[required]",
                """
                elements => elements
                    .filter(el => !el.value || el.value.trim() === '')
                    .map(el => el.name || el.id || el.placeholder || 'unknown_required_field')
                """,
            )
            manual_fields_needed.extend(required_unfilled)

            # Take screenshot before submitting
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            domain = urlparse(job_url).netloc.replace(".", "_")
            screenshot_filename = f"apply_{domain}_{ts}.png"
            screenshot_path_full = SCREENSHOTS_DIR / screenshot_filename
            await page.screenshot(path=str(screenshot_path_full), full_page=True)
            screenshot_path = str(screenshot_path_full)
            logger.info("Screenshot saved to %s", screenshot_path)

            # Do NOT auto-submit — leave that to the human
            await browser.close()

    except Exception as exc:
        logger.exception("Unexpected error during auto-apply to %s", job_url)
        error_message = str(exc)
        return {
            "status": "error",
            "screenshot_path": screenshot_path,
            "fields_filled": fields_filled,
            "manual_fields_needed": manual_fields_needed,
            "error": error_message,
        }

    status = "success" if not manual_fields_needed else "partial"
    return {
        "status": status,
        "screenshot_path": screenshot_path,
        "fields_filled": fields_filled,
        "manual_fields_needed": list(set(manual_fields_needed)),
        "error": "",
    }
