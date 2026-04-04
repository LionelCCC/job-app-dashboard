"""
SQLAlchemy model for the Candidate Memory / Profile page.

All data is stored locally in SQLite — nothing is sent to any external server.
This profile is used only for:
  - Playwright autofill (populating application form fields)
  - Claude AI cover letter / answer generation context
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Personal identifiers — used for form autofill
    full_name = Column(String(255), nullable=False, default="")
    email = Column(String(255), nullable=False, default="")
    phone = Column(String(64), nullable=True, default="")
    linkedin_url = Column(String(512), nullable=True, default="")
    github_url = Column(String(512), nullable=True, default="")
    portfolio_url = Column(String(512), nullable=True, default="")

    # Location / work preferences
    current_location = Column(String(255), nullable=True, default="")
    willing_to_relocate = Column(Boolean, nullable=False, default=False)

    # Work authorization — used in EEO / right-to-work fields
    # Values: "US Citizen", "Permanent Resident", "H1B", "F1/OPT", "TN Visa", "Other", "Not Applicable"
    work_authorization = Column(String(128), nullable=True, default="Not Applicable")

    # Job preferences
    desired_roles = Column(JSON, nullable=True, default=list)     # list of JobType strings
    salary_min = Column(Float, nullable=True)
    salary_max = Column(Float, nullable=True)
    salary_currency = Column(String(8), nullable=False, default="USD")

    # AI context — used when Claude generates cover letters / long-form answers
    cover_letter_template = Column(Text, nullable=True, default="")
    autofill_context = Column(
        Text, nullable=True, default=""
    )  # freeform notes, e.g. "I have 5 years Python experience, prefer remote…"

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<CandidateProfile id={self.id} name={self.full_name!r}>"
