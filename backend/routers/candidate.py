"""
FastAPI router for the Candidate Memory / Profile endpoints.

All data lives locally in SQLite. These endpoints are used by:
  - The Candidate Memory frontend page (GET / PUT)
  - The Playwright auto-applier to fill contact fields
  - The Claude AI context builder for cover letter generation

No candidate data is sent to any external service.
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, engine
from models_candidate import Base as CandidateBase, CandidateProfile

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/candidate", tags=["candidate"])

# Ensure table exists (idempotent)
CandidateBase.metadata.create_all(bind=engine)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CandidateProfileRequest(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    linkedin_url: str = ""
    github_url: str = ""
    portfolio_url: str = ""
    current_location: str = ""
    willing_to_relocate: bool = False
    work_authorization: str = "Not Applicable"
    desired_roles: list[str] = []
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: str = "USD"
    cover_letter_template: str = ""
    autofill_context: str = ""


class CandidateProfileResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str
    linkedin_url: str
    github_url: str
    portfolio_url: str
    current_location: str
    willing_to_relocate: bool
    work_authorization: str
    desired_roles: list[str]
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: str
    cover_letter_template: str
    autofill_context: str
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _profile_to_response(p: CandidateProfile) -> CandidateProfileResponse:
    return CandidateProfileResponse(
        id=p.id,
        full_name=p.full_name or "",
        email=p.email or "",
        phone=p.phone or "",
        linkedin_url=p.linkedin_url or "",
        github_url=p.github_url or "",
        portfolio_url=p.portfolio_url or "",
        current_location=p.current_location or "",
        willing_to_relocate=bool(p.willing_to_relocate),
        work_authorization=p.work_authorization or "Not Applicable",
        desired_roles=p.desired_roles or [],
        salary_min=p.salary_min,
        salary_max=p.salary_max,
        salary_currency=p.salary_currency or "USD",
        cover_letter_template=p.cover_letter_template or "",
        autofill_context=p.autofill_context or "",
        updated_at=p.updated_at or p.created_at,
    )


def _get_or_create_profile(db: Session) -> CandidateProfile:
    """There is only ever one candidate profile row (id=1)."""
    profile = db.query(CandidateProfile).first()
    if not profile:
        profile = CandidateProfile()
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=CandidateProfileResponse)
def get_candidate_profile(db: Session = Depends(get_db)):
    """
    Return the candidate's profile.
    If no profile has been saved yet, returns a default empty profile.
    This data is stored locally only and never sent externally.
    """
    profile = _get_or_create_profile(db)
    return _profile_to_response(profile)


@router.put("", response_model=CandidateProfileResponse)
def update_candidate_profile(
    request: CandidateProfileRequest,
    db: Session = Depends(get_db),
):
    """
    Create or update the candidate profile.
    All fields are optional — you can do partial updates by omitting fields
    (they will be set to their default/empty value, so send the full object).

    Data is stored locally only in SQLite.
    """
    profile = _get_or_create_profile(db)

    profile.full_name = request.full_name
    profile.email = request.email
    profile.phone = request.phone
    profile.linkedin_url = request.linkedin_url
    profile.github_url = request.github_url
    profile.portfolio_url = request.portfolio_url
    profile.current_location = request.current_location
    profile.willing_to_relocate = request.willing_to_relocate
    profile.work_authorization = request.work_authorization
    profile.desired_roles = request.desired_roles
    profile.salary_min = request.salary_min
    profile.salary_max = request.salary_max
    profile.salary_currency = request.salary_currency
    profile.cover_letter_template = request.cover_letter_template
    profile.autofill_context = request.autofill_context
    profile.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(profile)

    logger.info("Candidate profile updated: id=%d name=%r", profile.id, profile.full_name)
    return _profile_to_response(profile)
