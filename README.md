# JobPilot — AI-Powered Job Application Pipeline

A full-stack dashboard that automates the entire job application workflow: discover jobs → score your resume against the JD with AI → auto-edit to 80%+ ATS score → auto-apply with one click.

## Features

### Job Discovery
- Search LinkedIn, Indeed, and company-specific job boards
- Targets: Software Engineer, Data Engineer, Data Analyst, Data Scientist, ML Engineer, AI Engineer
- Paste any company careers URL to add a specific posting
- Validates that application links are live and accessible

### AI Resume Scoring (ATS Mode)
- Powered by **Claude Opus 4.6** with extended thinking
- Acts as both recruiter + ATS system simultaneously
- Scores on: keyword match, experience relevance, education fit, skills alignment
- Shows matched vs. missing keywords with specific suggestions
- **80%+ score = auto-apply ready**; below 80% = AI edit suggested

### AI Resume Editing
- Claude rewrites your resume to match the job description language
- Improves keyword density, reframes experience, adds implied skills
- **Truthfulness enforced** — never fabricates experience
- Side-by-side diff view before you approve

### Auto-Apply
- Playwright-powered browser automation (visible browser, not headless)
- Detects form platform: Greenhouse, Lever, Workday, LinkedIn Easy Apply, generic
- Auto-fills: name, email, phone, LinkedIn, GitHub, work authorization
- Uploads resume file automatically
- Screenshots the form before submitting — **you confirm before submit**

### Application Tracking
- Kanban pipeline: To Apply → Reviewing → Applying → Submitted → Failed
- Full audit trail per application

---

## Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone the repo
```bash
git clone https://github.com/LionelCCC/job-app-dashboard.git
cd job-app-dashboard
```

### 2. Backend setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium

# Set your API key
cp ../.env.example ../.env
# Edit .env and add your ANTHROPIC_API_KEY
export ANTHROPIC_API_KEY=sk-ant-...

# Start the backend
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```

Dashboard available at: http://localhost:3000

---

## Architecture

```
job-app-dashboard/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── models.py                  # SQLAlchemy ORM models
│   ├── database.py                # DB connection & session
│   ├── services/
│   │   ├── job_scraper.py         # LinkedIn, Indeed, company boards
│   │   ├── resume_parser.py       # PDF/DOCX parsing
│   │   ├── ats_scorer.py          # Claude API scoring & editing
│   │   └── auto_applier.py        # Playwright form automation
│   └── routers/
│       ├── jobs.py                # /api/jobs endpoints
│       ├── resumes.py             # /api/resumes endpoints
│       ├── scoring.py             # /api/scoring endpoints
│       └── applications.py        # /api/applications endpoints
├── frontend/
│   └── src/
│       ├── app/                   # Next.js App Router pages
│       │   ├── page.tsx           # Dashboard overview
│       │   ├── jobs/page.tsx      # Job discovery
│       │   ├── resumes/page.tsx   # Resume manager
│       │   └── applications/page.tsx  # Pipeline tracker
│       ├── components/            # Reusable UI components
│       └── lib/api.ts             # Typed API client
├── resumes/
│   ├── uploaded/                  # Original uploaded resumes
│   └── edited/                    # AI-edited resume versions
└── screenshots/                   # Auto-apply form screenshots
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI (Python), SQLAlchemy, SQLite |
| AI | Anthropic Claude Opus 4.6 (ATS scoring + resume editing) |
| Automation | Playwright (form auto-fill & submit) |
| Parsing | PyMuPDF (PDF), python-docx (DOCX) |
| Scraping | httpx + BeautifulSoup |

---

## Usage Workflow

1. **Upload resumes** → Go to Resumes, drag & drop your PDF/DOCX, select category (e.g., DE for Data Engineer version)
2. **Find jobs** → Go to Jobs, search by role + location, or paste a specific URL
3. **Score** → Click "Score Resume" on a job card, pick your resume → see ATS score
4. **Edit** (if score < 80%) → Click "AI Edit" → review the diff → click "Approve"
5. **Apply** → Click "Apply" in the Applications pipeline → browser opens, fields fill → confirm submission

---

## Notes

- Auto-apply works best on **Greenhouse** and **Lever** ATS systems
- LinkedIn Easy Apply requires you to be logged in (the browser will prompt you)
- Some companies use Workday which has complex multi-step forms — review carefully before confirming
- Your resumes are stored locally and **never sent to any third party** (only the text is sent to Anthropic for scoring)

---

## License

MIT — built for Lionel's job search 🚀
