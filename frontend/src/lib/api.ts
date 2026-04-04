const API_BASE = "http://localhost:8000";

// ─── Types ──────────────────────────────────────────────────────────────────

export type JobType = "SWE" | "DE" | "DA" | "DS" | "MLE" | "AIE";
export type JobSource = "LinkedIn" | "Indeed" | "Company Boards";
export type ApplicationStatus =
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
  source: string;
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
  upload_date: string;
  parsed_data?: {
    contact?: {
      name?: string;
      email?: string;
      phone?: string;
      location?: string;
      linkedin?: string;
      github?: string;
    };
    skills?: string[];
    experience?: Array<{
      title: string;
      company: string;
      start_date: string;
      end_date?: string;
      description?: string;
    }>;
    education?: Array<{
      degree: string;
      institution: string;
      year?: string;
    }>;
  };
  scored_jobs?: Array<{ job_id: number; job_title: string; score: number }>;
}

export interface ATSBreakdown {
  keyword_match: number;
  experience_match: number;
  education_match: number;
  skills_match: number;
}

export interface ATSResult {
  application_id: number;
  job_id: number;
  resume_id: number;
  overall_score: number;
  breakdown: ATSBreakdown;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
  created_at: string;
}

export interface Application {
  id: number;
  job_id: number;
  resume_id: number;
  status: ApplicationStatus;
  ats_score?: number;
  job?: Job;
  resume?: Resume;
  ats_result?: ATSResult;
  created_at: string;
  updated_at: string;
  fields_filled?: string[];
  edited_resume_diff?: string;
}

export interface SearchParams {
  keywords?: string;
  location?: string;
  job_types?: JobType[];
  sources?: JobSource[];
  limit?: number;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errorMsg = body.detail || body.message || errorMsg;
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMsg);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
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
  return handleResponse<Job[]>(res);
}

export async function searchJobs(
  params: SearchParams
): Promise<{ task_id: string }> {
  const res = await fetch(`${API_BASE}/jobs/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<{ task_id: string }>(res);
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

// ─── ATS / Analysis Endpoints ─────────────────────────────────────────────────

export async function analyzeResume(
  jobId: number,
  resumeId: number
): Promise<ATSResult> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, resume_id: resumeId }),
  });
  return handleResponse<ATSResult>(res);
}

export async function editResume(applicationId: number): Promise<{
  diff: string;
  edited_content: string;
}> {
  const res = await fetch(`${API_BASE}/applications/${applicationId}/edit`, {
    method: "POST",
  });
  return handleResponse<{ diff: string; edited_content: string }>(res);
}

export async function approveEdit(applicationId: number): Promise<void> {
  const res = await fetch(
    `${API_BASE}/applications/${applicationId}/approve-edit`,
    { method: "POST" }
  );
  return handleResponse<void>(res);
}

// ─── Application Endpoints ────────────────────────────────────────────────────

export async function applyToJob(applicationId: number): Promise<{
  status: string;
  fields_filled: string[];
}> {
  const res = await fetch(
    `${API_BASE}/applications/${applicationId}/apply`,
    { method: "POST" }
  );
  return handleResponse<{ status: string; fields_filled: string[] }>(res);
}

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

export async function updateApplicationStatus(
  id: number,
  status: ApplicationStatus
): Promise<Application> {
  const res = await fetch(`${API_BASE}/applications/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return handleResponse<Application>(res);
}

// ─── Stats Endpoint ────────────────────────────────────────────────────────────

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/stats`, { cache: "no-store" });
  return handleResponse<Stats>(res);
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
  if (!dateStr) return "Unknown date";
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
