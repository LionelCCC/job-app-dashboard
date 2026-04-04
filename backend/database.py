"""
SQLAlchemy database setup for the Job Application Pipeline Dashboard.
Database file: /Users/lionelc/Job app dashboard/jobs.db
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from models import Base

DATABASE_URL = "sqlite:////Users/lionelc/Job app dashboard/jobs.db"

# Connect args needed for SQLite to allow multi-threaded access from FastAPI
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def create_all_tables() -> None:
    """Create all tables defined in the ORM metadata."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a database session per request.
    Ensures the session is closed after each request.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
