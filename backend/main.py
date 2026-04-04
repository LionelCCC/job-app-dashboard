"""
Main FastAPI application entry point for the Job Application Pipeline Dashboard.

Start the server with:
    uvicorn main:app --reload --port 8000
"""

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import create_all_tables
from routers import applications, jobs, resumes, scoring

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Directories that must exist at startup
# ---------------------------------------------------------------------------

_REQUIRED_DIRS = [
    Path("/Users/lionelc/Job app dashboard/backend/resumes/uploaded"),
    Path("/Users/lionelc/Job app dashboard/backend/resumes/edited"),
    Path("/Users/lionelc/Job app dashboard/backend/screenshots"),
]

for _d in _REQUIRED_DIRS:
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# App instantiation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Job Application Pipeline API",
    description=(
        "Backend API for the Job Application Pipeline Dashboard. "
        "Manages job listings, resumes, ATS scoring, and automated applications."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS – allow all origins for local development
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static file serving
# ---------------------------------------------------------------------------

SCREENSHOTS_DIR = Path("/Users/lionelc/Job app dashboard/backend/screenshots")
app.mount(
    "/screenshots",
    StaticFiles(directory=str(SCREENSHOTS_DIR)),
    name="screenshots",
)

EDITED_RESUMES_DIR = Path("/Users/lionelc/Job app dashboard/backend/resumes/edited")
app.mount(
    "/edited-resumes",
    StaticFiles(directory=str(EDITED_RESUMES_DIR)),
    name="edited_resumes",
)

# ---------------------------------------------------------------------------
# Startup event
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup():
    """Create database tables on application startup."""
    logger.info("Creating database tables if they do not exist…")
    create_all_tables()
    logger.info("Database ready at /Users/lionelc/Job app dashboard/jobs.db")


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(jobs.router, prefix="/api")
app.include_router(resumes.router, prefix="/api")
app.include_router(scoring.router, prefix="/api")
app.include_router(applications.router, prefix="/api")

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"])
def health_check():
    """Simple liveness probe."""
    return {
        "status": "ok",
        "service": "Job Application Pipeline API",
    }


@app.get("/", tags=["root"])
def root():
    """Root endpoint – redirects consumers to the API docs."""
    return {
        "message": "Job Application Pipeline API",
        "docs": "/docs",
        "health": "/health",
    }
