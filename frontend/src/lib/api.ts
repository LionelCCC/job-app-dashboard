// All requests go to http://localhost:8000/api/...
const API_BASE = "http://localhost:8000/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export type JobType = "SWE" | "DE" | "DA" | "DS" | "MLE" | "AIE";
export type JobSource = "LinkedIn" | "Indeed" | "Company Boards";
export type ApplicationStatus =
  | "pending"
  | "to_apply"
  | "reviewing"
  | "applying"
  | "submitted"
  | "failed";

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  job_type: JobType;
  source?: string;
  url: string;
  description?: string;
  posted_date?: string;
  created_at: string;
  status: "new" | "scored" | "applied";
  ats_score?: number;
}

export interface Resume {
  id: number;
  filename: string;
  category: JobType;
  uploaded_at: string;
  parsed_data?: {
    contact_info?: {
      name?: string;
      email?: string;
      phone?: string;
      linkedin?: string;
      github?: string;
    };
    skills?: string[];
    experience?: Array<{
      company?: string;
      role?: string;
      duration?: string;
      description?: string;
    }>;
    education?: Array<{
      institution?: string;
      degree?: string;
      year?: string;
    }>;
    summary?: string;
  };
}

export interface ATSBreakdown {
  keyword_score: number;
  experience_score: number;
  education_score: number;
  skills_score: number;
}

export interface ATSResult {
  application_id: number;
  job_id: number;
  resume_id: number;
  overall_score: number;
  breakdown?: ATSBreakdown;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
  ats_friendly_issues?: string[];
  verdict?: "PASS" | "FAIL";
  human_approved: boolean;
  edited_resume_path?: string;
  status: string;
  created_at?: string;
}

export interface Application {
  id: number;
  job_id: number;
  resume_id: number;
  status: ApplicationStatus;
  ats_score?: number;
  human_approved?: boolean;
  notes?: string;
  job?: Job;
  resume?: Resume;
  ats_result?: ATSResult;
  created_at: string;
  applied_at?: string;
}

export interface SearchParams {
  keywords?: string;
  location?: string;
  job_types?: JobType[];
  sources?: string[];
  limit?: number;
}

export interface SearchResult {
  scraped: number;
  saved: number;
  jobs: Job[];
  errors: string[];
}

export interface Stats {
  total_jobs: number;
  total_resumes: number;
  total_applications: number;
  avg_ats_score: number;
  pipeline: {
    found: number;
    scored: number;
    approved: number;
    applied: number;
  };
  ats_distribution: {
    "0-20": number;
    "20-40": number;
    "40-60": number;
    "60-80": number;
    "80-100": number;
  };
  job_type_breakdown: Record<JobType, number>;
  recent_applications: Application[];
}

export interface CandidateProfile {
  id?: number;
  full_name: string;
  email: string;
  phone: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  current_location: string;
  willing_to_relocate: boolean;
  work_authorization: string;
  desired_roles: JobType[];
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  cover_letter_template: string;
  autofill_context: string;
  updated_at?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") {
        errorMsg = body.detail;
      } else if (Array.isArray(body.detail)) {
        // FastAPI 422 validation errors return detail as array of error objects
        errorMsg = body.detail
          .map((e: { msg: string; loc?: string[] }) => {
            const field = e.loc?.slice(1).join(".") || "field";
            return `${field}: ${e.msg}`;
          })
          .join(" | ");
      } else if (body.message) {
        errorMsg = body.message;
      }
    } catch {
      // ignore json parse errors — keep default HTTP status message
    }
    throw new Error(errorMsg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/stats`, { cache: "no-store" });
  return handleResponse<Stats>(res);
}

// ─── Job Endpoints ────────────────────────────────────────────────────────────

export async function fetchJobs(filters?: {
  status?: string;
  job_type?: JobType;
  search?: string;
}): Promise<Job[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.job_type) params.set("job_type", filters.job_type);
  if (filters?.search) params.set("search", filters.search);
  const url = `${API_BASE}/jobs${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await handleResponse<{ jobs: Job[]; total: number } | Job[]>(res);
  return Array.isArray(data) ? data : (data as { jobs: Job[] }).jobs ?? [];
}

export async function searchJobs(params: SearchParams): Promise<SearchResult> {
  // Normalize source names: frontend uses display names, backend wants lowercase
  const sourceMap: Record<string, string | null> = {
    linkedin: "linkedin",
    LinkedIn: "linkedin",
    indeed: "indeed",
    Indeed: "indeed",
    "Company Boards": null, // not supported for keyword search — handled with errors
    "company boards": null,
  };

  const normalizedSources: string[] = [];
  const sourceErrors: string[] = [];

  for (const s of params.sources ?? ["LinkedIn", "Indeed"]) {
    const mapped = sourceMap[s];
    if (mapped === null) {
      sourceErrors.push(
        `"${s}" cannot be keyword-searched. Use "Add Job by URL" to add individual postings from company careers pages.`
      );
    } else if (mapped) {
      normalizedSources.push(mapped);
    } else {
      sourceErrors.push(`"${s}" is an unrecognized source.`);
    }
  }

  // If every source was unsupported, skip the API call and return errors
  if (normalizedSources.length === 0) {
    return { scraped: 0, saved: 0, jobs: [], errors: sourceErrors };
  }

  const payload = {
    keywords: params.keywords || "",
    location: params.location || "Remote",
    job_types: params.job_types ?? [],
    sources: normalizedSources,
  };

  const res = await fetch(`${API_BASE}/jobs/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{
    scraped: number;
    saved: number;
    jobs: Job[];
    errors?: string[];
  }>(res);

  return {
    scraped: data.scraped,
    saved: data.saved,
    jobs: data.jobs ?? [],
    errors: [...sourceErrors, ...(data.errors ?? [])],
  };
}

export async function addJobUrl(url: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/add-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return handleResponse<Job>(res);
}

export async function deleteJob(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${id}`, { method: "DELETE" });
  return handleResponse<void>(res);
}

// ─── Resume Endpoints ─────────────────────────────────────────────────────────

export async function uploadResume(
  file: File,
  category: JobType
): Promise<Resume> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  const res = await fetch(`${API_BASE}/resumes/upload`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<Resume>(res);
}

export async function fetchResumes(): Promise<Resume[]> {
  const res = await fetch(`${API_BASE}/resumes`, { cache: "no-store" });
  return handleResponse<Resume[]>(res);
}

export async function deleteResume(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/resumes/${id}`, { method: "DELETE" });
  return handleResponse<void>(res);
}

// ─── Scoring / ATS Endpoints ──────────────────────────────────────────────────

export async function analyzeResume(
  jobId: number,
  resumeId: number
): Promise<ATSResult> {
  const res = await fetch(`${API_BASE}/scoring/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, resume_id: resumeId }),
  });
  return handleResponse<ATSResult>(res);
}

export async function editResume(applicationId: number): Promise<ATSResult> {
  const res = await fetch(`${API_BASE}/scoring/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ application_id: applicationId }),
  });
  return handleResponse<ATSResult>(res);
}

export async function approveEdit(applicationId: number): Promise<ATSResult> {
  const res = await fetch(`${API_BASE}/scoring/approve/${applicationId}`, {
    method: "POST",
  });
  return handleResponse<ATSResult>(res);
}

export async function getScoringResult(
  applicationId: number
): Promise<ATSResult> {
  const res = await fetch(`${API_BASE}/scoring/result/${applicationId}`, {
    cache: "no-store",
  });
  return handleResponse<ATSResult>(res);
}

// ─── Application Endpoints ────────────────────────────────────────────────────

export async function fetchApplications(): Promise<Application[]> {
  const res = await fetch(`${API_BASE}/applications`, { cache: "no-store" });
  return handleResponse<Application[]>(res);
}

export async function fetchApplication(id: number): Promise<Application> {
  const res = await fetch(`${API_BASE}/applications/${id}`, {
    cache: "no-store",
  });
  return handleResponse<Application>(res);
}

export async function applyToJob(applicationId: number): Promise<{
  status: string;
  fields_filled: string[];
}> {
  const res = await fetch(`${API_BASE}/applications/${applicationId}/apply`, {
    method: "POST",
  });
  return handleResponse<{ status: string; fields_filled: string[] }>(res);
}

export async function updateApplicationStatus(
  id: number,
  status: ApplicationStatus
): Promise<Application> {
  const res = await fetch(`${API_BASE}/applications/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return handleResponse<Application>(res);
}

export async function updateApplicationNotes(
  id: number,
  notes: string
): Promise<Application> {
  const res = await fetch(`${API_BASE}/applications/${id}/notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  return handleResponse<Application>(res);
}

// ─── Site Monitor Types ────────────────────────────────────────────────────────

export interface TrackedSite {
  id: number;
  name: string;
  url: string;
  company: string;
  notes?: string;
  interval_hours: number;
  interval_label: string;
  is_active: boolean;
  last_checked_at?: string;
  next_check_at?: string;
  jobs_found_total: number;
  new_jobs_last_check: number;
  recent_logs: SiteCheckLog[];
}

export interface SiteCheckLog {
  id: number;
  site_id: number;
  checked_at: string;
  jobs_found: number;
  new_jobs: number;
  status: "success" | "error" | "no_change";
  error_message?: string;
  job_titles_found?: string[];
}

export interface SiteMonitorStats {
  total_sites: number;
  active_sites: number;
  total_checks_run: number;
  total_jobs_found: number;
  sites_due_now: number;
  next_scheduled?: string;
}

// ─── Site Monitor Endpoints ────────────────────────────────────────────────────

export async function fetchTrackedSites(): Promise<TrackedSite[]> {
  const res = await fetch(`${API_BASE}/history/`, { cache: "no-store" });
  return handleResponse<TrackedSite[]>(res);
}

export async function addTrackedSite(data: {
  url: string;
  name: string;
  company: string;
  notes?: string;
  interval_hours: number;
}): Promise<TrackedSite> {
  const res = await fetch(`${API_BASE}/history/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<TrackedSite>(res);
}

export async function updateTrackedSite(
  id: number,
  data: Partial<{
    name: string;
    notes: string;
    interval_hours: number;
    is_active: boolean;
  }>
): Promise<TrackedSite> {
  const res = await fetch(`${API_BASE}/history/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<TrackedSite>(res);
}

export async function deleteTrackedSite(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/history/${id}`, { method: "DELETE" });
  return handleResponse<void>(res);
}

export async function checkSiteNow(id: number): Promise<{
  status: string;
  jobs_found: number;
  new_jobs: number;
  job_titles_found: string[];
  error_message?: string;
}> {
  const res = await fetch(`${API_BASE}/history/${id}/check-now`, {
    method: "POST",
  });
  return handleResponse<{
    status: string;
    jobs_found: number;
    new_jobs: number;
    job_titles_found: string[];
    error_message?: string;
  }>(res);
}

export async function fetchSiteLogs(
  id: number,
  page = 1
): Promise<SiteCheckLog[]> {
  const res = await fetch(`${API_BASE}/history/${id}/logs?page=${page}`, {
    cache: "no-store",
  });
  return handleResponse<SiteCheckLog[]>(res);
}

export async function fetchSiteMonitorStats(): Promise<SiteMonitorStats> {
  const res = await fetch(`${API_BASE}/history/stats`, { cache: "no-store" });
  return handleResponse<SiteMonitorStats>(res);
}

// ─── Candidate Profile Endpoints ──────────────────────────────────────────────

export async function fetchCandidateProfile(): Promise<CandidateProfile | null> {
  const res = await fetch(`${API_BASE}/candidate`, { cache: "no-store" });
  if (res.status === 404) return null;
  return handleResponse<CandidateProfile>(res);
}

export async function saveCandidateProfile(
  data: CandidateProfile
): Promise<CandidateProfile> {
  const res = await fetch(`${API_BASE}/candidate`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<CandidateProfile>(res);
}

// ─── Utility ───────────────────────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

export function getScoreBg(score: number): string {
  if (score >= 80) return "bg-green-400/10 border-green-400/30 text-green-400";
  if (score >= 60)
    return "bg-yellow-400/10 border-yellow-400/30 text-yellow-400";
  return "bg-red-400/10 border-red-400/30 text-red-400";
}

export function getJobTypeBadgeClass(type: JobType): string {
  const map: Record<JobType, string> = {
    SWE: "badge-swe",
    DE: "badge-de",
    DA: "badge-da",
    DS: "badge-ds",
    MLE: "badge-mle",
    AIE: "badge-aie",
  };
  return `badge ${map[type] || ""}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function timeUntil(isoString: string): string {
  const diffMins = Math.round(
    (new Date(isoString).getTime() - Date.now()) / 60000
  );
  const absMins = Math.abs(diffMins);
  if (absMins < 2) return "Due now";
  const days = Math.floor(absMins / 1440);
  const hours = Math.floor((absMins % 1440) / 60);
  const mins = absMins % 60;
  const label =
    days > 0
      ? `${days}d${hours > 0 ? ` ${hours}h` : ""}`
      : hours > 0
      ? `${hours}h${mins > 0 ? ` ${mins}m` : ""}`
      : `${mins}m`;
  return diffMins > 0 ? `in ${label}` : `Overdue by ${label}`;
}

export function timeAgo(isoString: string): string {
  const diffMins = Math.floor(
    (Date.now() - new Date(isoString).getTime()) / 60000
  );
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const hours = Math.floor(diffMins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
}
