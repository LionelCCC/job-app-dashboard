"""
SQLAlchemy ORM models for the Site Monitoring feature.

TrackedSite  — a URL the user wants to poll periodically for new job listings.
SiteCheckLog — one log entry per polling run for a tracked site.
"""

from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
)
from sqlalchemy.orm import relationship

from database import engine
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class TrackedSite(Base):
    __tablename__ = "tracked_sites"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)           # e.g. "Google Careers"
    url = Column(Text, nullable=False)                   # URL to monitor
    company = Column(String(255), nullable=False)        # company name
    notes = Column(Text, nullable=True)                  # user notes

    # 24=daily, 48=every 2 days, 72=every 3 days,
    # 168=weekly, 336=biweekly, 720=monthly
    interval_hours = Column(Integer, nullable=False, default=24)

    is_active = Column(Boolean, nullable=False, default=True)

    last_checked_at = Column(DateTime, nullable=True)
    next_check_at = Column(DateTime, nullable=True)      # last_checked_at + interval_hours

    jobs_found_total = Column(Integer, nullable=False, default=0)   # cumulative
    new_jobs_last_check = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    check_logs = relationship(
        "SiteCheckLog",
        back_populates="site",
        cascade="all, delete-orphan",
        order_by="SiteCheckLog.checked_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<TrackedSite id={self.id} name={self.name!r} company={self.company!r}>"


class SiteCheckLog(Base):
    __tablename__ = "site_check_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    site_id = Column(
        Integer,
        ForeignKey("tracked_sites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    checked_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    jobs_found = Column(Integer, nullable=False, default=0)  # total jobs scraped this run
    new_jobs = Column(Integer, nullable=False, default=0)    # URLs not previously seen
    # "success" | "error" | "no_change"
    status = Column(String(32), nullable=False, default="success")
    error_message = Column(Text, nullable=True)
    job_titles_found = Column(JSON, nullable=True)           # list[str] of titles

    # Relationships
    site = relationship("TrackedSite", back_populates="check_logs")

    def __repr__(self) -> str:
        return (
            f"<SiteCheckLog id={self.id} site_id={self.site_id} "
            f"status={self.status!r} new_jobs={self.new_jobs}>"
        )
