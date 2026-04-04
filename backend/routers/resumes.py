"""
FastAPI router for resume management endpoints.
Supports PDF, DOCX, and LaTeX (.tex) uploads.
"""

import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Resume, JobType
from services.resume_parser import parse_resume, categorize_resume

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/resumes", tags=["resumes"])

UPLOAD_DIR = Path("/Users/lionelc/Job app dashboard/backend/resumes/uploaded")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".tex", ".latex"}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ResumeResponse(BaseModel):
    id: int
    filename: str
    original_path: str
    category: str
    content: Optional[str] = None
    parsed_data: Optional[dict] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resume_to_response(resume: Resume) -> ResumeResponse:
    return ResumeResponse(
        id=resume.id,
        filename=resume.filename,
        original_path=resume.original_path,
        category=resume.category.value if resume.category else "SWE",
        content=resume.content,
        parsed_data=resume.parsed_data,
        uploaded_at=resume.uploaded_at,
    )


def _validate_extension(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )
    return ext


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ResumeResponse])
def list_resumes(db: Session = Depends(get_db)):
    """Return all uploaded resumes, newest first."""
    resumes = db.query(Resume).order_by(Resume.uploaded_at.desc()).all()
    return [_resume_to_response(r) for r in resumes]


@router.post("/upload", response_model=ResumeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    category: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Upload a resume file (PDF, DOCX, or LaTeX .tex), parse it,
    and store the result in the database.

    The category is optional — if omitted, it will be auto-detected from the
    resume content. Valid values: SWE, DE, DA, DS, MLE, AIE.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = _validate_extension(file.filename)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_stem = Path(file.filename).stem.replace(" ", "_")
    saved_filename = f"{safe_stem}_{ts}{ext}"
    save_path = UPLOAD_DIR / saved_filename

    # Write the file to disk
    try:
        async with aiofiles.open(save_path, "wb") as out_file:
            content_bytes = await file.read()
            await out_file.write(content_bytes)
    except OSError as exc:
        logger.error("Failed to save uploaded file: %s", exc)
        raise HTTPException(status_code=500, detail=f"File save failed: {exc}")

    # Parse the resume
    try:
        parsed = parse_resume(str(save_path))
    except Exception as exc:
        logger.error("Resume parsing failed for %s: %s", save_path, exc)
        parsed = {
            "full_text": "",
            "contact_info": {},
            "skills": [],
            "experience": [],
            "education": [],
            "certifications": [],
            "summary": "",
        }

    full_text = parsed.get("full_text", "")

    # Determine category: use provided value, or auto-detect from content
    if category:
        category_str = category.upper()
    else:
        try:
            category_str = categorize_resume(parsed)
        except Exception:
            category_str = "SWE"

    try:
        category_enum = JobType(category_str)
    except ValueError:
        category_enum = JobType.SWE

    parsed_data_payload = {
        "contact_info": parsed.get("contact_info", {}),
        "skills": parsed.get("skills", []),
        "experience": parsed.get("experience", []),
        "education": parsed.get("education", []),
        "certifications": parsed.get("certifications", []),
        "summary": parsed.get("summary", ""),
    }

    resume = Resume(
        filename=file.filename,
        original_path=str(save_path),
        category=category_enum,
        content=full_text,
        parsed_data=parsed_data_payload,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    logger.info(
        "Resume uploaded: id=%d filename=%s category=%s",
        resume.id, resume.filename, category_enum.value,
    )
    return _resume_to_response(resume)


@router.get("/by-category/{category}", response_model=list[ResumeResponse])
def get_resumes_by_category(category: str, db: Session = Depends(get_db)):
    """Return all resumes that match a given job-type category."""
    try:
        category_enum = JobType(category.upper())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{category}'. Valid: {[e.value for e in JobType]}",
        )
    resumes = (
        db.query(Resume)
        .filter(Resume.category == category_enum)
        .order_by(Resume.uploaded_at.desc())
        .all()
    )
    return [_resume_to_response(r) for r in resumes]


@router.get("/{resume_id}", response_model=ResumeResponse)
def get_resume(resume_id: int, db: Session = Depends(get_db)):
    """Return a single resume by ID."""
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail=f"Resume {resume_id} not found")
    return _resume_to_response(resume)


@router.delete("/{resume_id}", response_model=dict)
def delete_resume(resume_id: int, db: Session = Depends(get_db)):
    """Delete a resume by ID and remove the file from disk."""
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail=f"Resume {resume_id} not found")

    file_path = Path(resume.original_path)
    if file_path.exists():
        try:
            file_path.unlink()
        except OSError as exc:
            logger.warning("Could not delete file %s: %s", file_path, exc)

    db.delete(resume)
    db.commit()
    return {"deleted": resume_id}
