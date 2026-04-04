"""
SQLAlchemy ORM models for the Job Application Pipeline Dashboard.
"""

import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime,
    ForeignKey, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class JobType(str, enum.Enum):
    SWE = "SWE"   # Software Engineer
    DE = "DE"     # Data Engineer
    DA = "DA"     # Data Analyst
    DS = "DS"     # Data Scientist
    MLE = "MLE"   # Machine Learning Engineer
    AIE = "AIE"   # AI Engineer


class JobStatus(str, enum.Enum):
    new = "new"
    scored = "scored"
    applied = "applied"
    rejected = "rejected"


class ApplicationStatus(str, enum.Enum):
    pending = "pending"
    reviewing = "reviewing"
    applying = "applying"
    submitted = "submitted"
    failed = "failed"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    location = Column(String(255), nullable=True)
    url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    job_type = Column(SAEnum(JobType), nullable=False, default=JobType.SWE)
    salary_range = Column(String(255), nullable=True)
    posted_date = Column(DateTime, nullable=True)
    status = Column(SAEnum(JobStatus), nullable=False, default=JobStatus.new)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Job id={self.id} title={self.title!r} company={self.company!r}>"


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename = Column(String(255), nullable=False)
    original_path = Column(Text, nullable=False)
    category = Column(SAEnum(JobType), nullable=False, default=JobType.SWE)
    content = Column(Text, nullable=True)          # full extracted plain text
    parsed_data = Column(JSON, nullable=True)       # structured fields
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    applications = relationship("Application", back_populates="resume", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Resume id={self.id} filename={self.filename!r} category={self.category}>"


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False)
    ats_score = Column(Float, nullable=True)
    ats_breakdown = Column(JSON, nullable=True)         # full ATS analysis dict
    edited_resume_path = Column(Text, nullable=True)
    status = Column(SAEnum(ApplicationStatus), nullable=False, default=ApplicationStatus.pending)
    human_approved = Column(Boolean, nullable=False, default=False)
    notes = Column(Text, nullable=True)                 # candidate's manual notes
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    applied_at = Column(DateTime, nullable=True)

    job = relationship("Job", back_populates="applications")
    resume = relationship("Resume", back_populates="applications")
    ats_analyses = relationship(
        "ATSAnalysis", back_populates="application", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return (
            f"<Application id={self.id} job_id={self.job_id} "
            f"resume_id={self.resume_id} status={self.status}>"
        )


class ATSAnalysis(Base):
    __tablename__ = "ats_analyses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    application_id = Column(
        Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    score = Column(Float, nullable=False)
    keyword_score = Column(Float, nullable=False)
    experience_score = Column(Float, nullable=False)
    education_score = Column(Float, nullable=False)
    skills_score = Column(Float, nullable=False)
    suggestions = Column(JSON, nullable=True)
    matched_keywords = Column(JSON, nullable=True)
    missing_keywords = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    application = relationship("Application", back_populates="ats_analyses")

    def __repr__(self):
        return (
            f"<ATSAnalysis id={self.id} application_id={self.application_id} "
            f"score={self.score}>"
        )
