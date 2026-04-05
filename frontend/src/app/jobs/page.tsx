"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search, Link2, Plus, AlertCircle, Loader2,
  Filter, RefreshCw, CheckSquare, Square, X, Info, Target,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import WorkflowStages from "@/components/WorkflowStages";
import JobCard from "@/components/JobCard";
import ATSScoreModal from "@/components/ATSScoreModal";
import {
  fetchJobs, searchJobs, addJobUrl, deleteJob, analyzeResume, fetchResumes,
  Job, JobType, Resume, ATSResult, SearchParams,
} from "@/lib/api";

const JOB_TYPES: JobType[] = ["SWE", "DE", "DA", "DS", "MLE", "AIE"];
const SOURCES = ["LinkedIn", "Indeed", "Company Boards"] as const;
const EXP_FILTERS = [
  { label: "New Grad", keywords: ["new grad", "entry level", "0-1", "junior", "fresh"] },
  { label: "1+ yr",    keywords: ["1+ year", "1 year", "1-2 year"] },
  { label: "2+ yr",    keywords: ["2+ year", "2 year", "2-3 year"] },
  { label: "3+ yr",    keywords: ["3+ year", "3 year", "3-5 year"] },
  { label: "5+ yr",    keywords: ["5+ year", "5 year", "senior"] },
  { label: "7+ yr",    keywords: ["7+ year", "7 year", "staff", "principal", "lead"] },
];
const STATUS_FILTERS = [
  { value: "all",    label: "All"     },
  { value: "new",    label: "New"     },
  { value: "scored", label: "Scored"  },
  { value: "applied",label: "Applied" },
];

// ─── Pill toggle group ────────────────────────────────────────────────────────
function PillGroup<T extends string>({
  options, selected, onChange, disabledOptions, disabledTooltips,
}: {
  options: T[];
  selected: T[];
  onChange: (vals: T[]) => void;
  disabledOptions?: T[];
  disabledTooltips?: Partial<Record<T, string>>;
}) {
  const toggle = (val: T) => {
    if (disabledOptions?.includes(val)) return;
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active   = selected.includes(opt);
        const disabled = disabledOptions?.includes(opt);
        const tooltip  = disabledTooltips?.[opt];
        return (
          <button
            key={opt} type="button" onClick={() => toggle(opt)} title={tooltip}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={
              disabled
                ? { backgroundColor: "rgba(0,22,45,0.4)", color: "var(--text-muted)", borderColor: "var(--border)", cursor: "not-allowed", opacity: 0.5 }
                : active
                ? { backgroundColor: "rgba(219,230,76,0.13)", color: "var(--spring)", borderColor: "rgba(219,230,76,0.35)" }
                : { backgroundColor: "rgba(30,72,143,0.12)", color: "var(--text-secondary)", borderColor: "var(--border)" }
            }
          >
            {disabled ? <Info size={11} /> : active ? <CheckSquare size={11} /> : <Square size={11} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function JobsPage() {
  const [jobs, setJobs]         = useState<Job[]>([]);
  const [resumes, setResumes]   = useState<Resume[]>([]);
  const [loading, setLoading]   = useState(true);
  const [searching, setSearching] = useState(false);
  const [addingUrl, setAddingUrl] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [searchWarnings, setSearchWarnings] = useState<string[]>([]);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedExpFilters, setSelectedExpFilters] = useState<string[]>([]);

  // Search form
  const [keywords, setKeywords]   = useState("");
  const [location, setLocation]   = useState("");
  const [selectedTypes, setSelectedTypes] = useState<JobType[]>([]);
  const [selectedSources, setSelectedSources] = useState<(typeof SOURCES)[number][]>(["LinkedIn", "Indeed"]);

  // URL add
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  // Score modal
  const [scoreModal, setScoreModal] = useState<{ job: Job; resumeId?: number; result?: ATSResult; applicationId?: number } | null>(null);
  const [scoring, setScoring] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [j, r] = await Promise.all([
        fetchJobs(statusFilter !== "all" ? { status: statusFilter } : {}),
        fetchResumes(),
      ]);
      setJobs(j); setResumes(r);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load jobs"); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true); setError(null); setSearchWarnings([]); setSearchInfo(null);
    try {
      const params: SearchParams = {
        keywords: keywords.trim() || undefined,
        location: location.trim() || undefined,
        job_types: selectedTypes.length ? selectedTypes : undefined,
        sources: selectedSources.length ? [...selectedSources] : undefined,
      };
      const result = await searchJobs(params);
      if (result.jobs.length > 0) {
        setJobs((prev) => {
          const ids = new Set(prev.map((j) => j.id));
          return [...result.jobs.filter((j) => !ids.has(j.id)), ...prev];
        });
        setSearchInfo(`Found ${result.scraped} jobs · ${result.saved} new saved`);
      } else if (result.errors.length === 0) {
        setSearchInfo("No new jobs found matching your criteria.");
      }
      if (result.errors.length > 0) setSearchWarnings(result.errors);
    } catch (err) { setError(err instanceof Error ? err.message : "Search failed"); }
    finally { setSearching(false); }
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setAddingUrl(true); setUrlError(null);
    try {
      const job = await addJobUrl(urlInput.trim());
      setJobs((prev) => prev.some((j) => j.id === job.id) ? prev : [job, ...prev]);
      setUrlInput("");
    } catch (err) { setUrlError(err instanceof Error ? err.message : "Failed to add job URL"); }
    finally { setAddingUrl(false); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteJob(id); setJobs((prev) => prev.filter((j) => j.id !== id)); }
    catch (err) { alert(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handleScore = (job: Job) => setScoreModal({ job });

  const handleScoreWithResume = async (resumeId: number) => {
    if (!scoreModal) return;
    setScoring(true);
    try {
      const result = await analyzeResume(scoreModal.job.id, resumeId);
      setScoreModal((prev) => prev ? { ...prev, resumeId, result, applicationId: result.application_id } : null);
      setJobs((prev) => prev.map((j) => j.id === scoreModal.job.id ? { ...j, ats_score: result.overall_score, status: "scored" } : j));
    } catch (err) { alert(err instanceof Error ? err.message : "Scoring failed"); }
    finally { setScoring(false); }
  };

  // ─── Client-side experience filter ──────────────────────────────────────────
  const expFilteredJobs = (() => {
    if (selectedExpFilters.length === 0) return jobs;
    const activeKeywords = selectedExpFilters.flatMap((label) =>
      EXP_FILTERS.find((e) => e.label === label)?.keywords ?? []
    );
    return jobs.filter((j) => {
      const hay = `${j.title} ${j.description ?? ""}`.toLowerCase();
      return activeKeywords.some((kw) => hay.includes(kw));
    });
  })();

  const filteredJobs = statusFilter === "all"
    ? expFilteredJobs
    : expFilteredJobs.filter((j) => j.status === statusFilter);

  const inputStyle: React.CSSProperties = {
    backgroundColor: "rgba(0,22,45,0.7)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    padding: "0.625rem 0.75rem",
    fontSize: "0.875rem",
    color: "var(--praxeti)",
    width: "100%",
    outline: "none",
  };
  const cardStyle: React.CSSProperties = {
    backgroundColor: "var(--midnight-card)",
    border: "1px solid var(--border)",
    borderRadius: "0.875rem",
    padding: "1.25rem 1.5rem",
  };

  return (
    <div className="flex flex-col min-h-full">
      <WorkflowStages
        resumeCount={resumes.length}
        jobCount={jobs.length}
        scoredCount={jobs.filter((j) => j.status === "scored" || j.ats_score !== undefined).length}
        appliedCount={jobs.filter((j) => j.status === "applied").length}
        activeStage="discovery"
      />

      <div className="p-8 space-y-5 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--praxeti)" }}>Discovery</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Search, add, and shortlist job postings</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/scoring" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: "rgba(219,230,76,0.10)", border: "1px solid rgba(219,230,76,0.25)", color: "var(--spring)" }}>
              <Target size={13} /> Score Jobs
            </Link>
            <button
              onClick={loadJobs}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Search form */}
        <div style={cardStyle}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <Search size={14} style={{ color: "var(--spring)" }} /> Search Jobs
          </h2>
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Keywords + Location */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Keywords <span style={{ color: "var(--text-muted)", opacity: 0.7 }}>(optional)</span>
                </label>
                <input
                  type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. Machine Learning, Python, React..."
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Location</label>
                <input
                  type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco, Remote..."
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Job types */}
            <div>
              <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>Role Type</label>
              <PillGroup options={JOB_TYPES} selected={selectedTypes} onChange={setSelectedTypes} />
            </div>

            {/* Experience level */}
            <div>
              <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                Experience Level <span style={{ color: "var(--text-muted)", opacity: 0.7 }}>(filters results by title/description)</span>
              </label>
              <PillGroup
                options={EXP_FILTERS.map((e) => e.label) as string[] as any}
                selected={selectedExpFilters as any}
                onChange={(v) => setSelectedExpFilters(v as string[])}
              />
            </div>

            {/* Sources */}
            <div>
              <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>Sources</label>
              <PillGroup
                options={[...SOURCES]}
                selected={selectedSources}
                onChange={setSelectedSources}
                disabledOptions={["Company Boards"]}
                disabledTooltips={{ "Company Boards": "Company Boards can't be keyword-searched. Use Add by URL below." }}
              />
              <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <Info size={10} /> Company career pages (Greenhouse, Lever, Workday) require a direct URL.
              </p>
            </div>

            {/* Results */}
            {searchInfo && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "rgba(116,195,101,0.10)", border: "1px solid rgba(116,195,101,0.25)", color: "var(--mantis)" }}>
                <CheckSquare size={12} /> {searchInfo}
              </div>
            )}
            {searchWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#FBBF24" }}>
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" /> {w}
              </div>
            ))}

            <div className="flex justify-end">
              <button
                type="submit" disabled={searching}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "var(--spring)", color: "var(--midnight)" }}
              >
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {searching ? "Searching…" : "Search Jobs"}
              </button>
            </div>
          </form>
        </div>

        {/* Add URL */}
        <div style={cardStyle}>
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <Link2 size={14} style={{ color: "var(--nuit-light)" }} /> Add Job by URL
          </h2>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Works with Greenhouse, Lever, Workday, LinkedIn, Indeed, and most company careers pages.
          </p>
          <div className="flex gap-2">
            <input
              type="url" value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              placeholder="https://boards.greenhouse.io/company/jobs/123..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleAddUrl} disabled={addingUrl || !urlInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex-shrink-0"
              style={{ backgroundColor: "var(--nuit)", color: "var(--praxeti)" }}
            >
              {addingUrl ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>
          {urlError && (
            <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "#EF4444" }}>
              <X size={11} /> {urlError}
            </p>
          )}
        </div>

        {/* Job list */}
        <div>
          {/* Filter bar */}
          <div className="flex items-center justify-between mb-4">
            <div
              className="flex items-center gap-1 p-1 rounded-lg"
              style={{ backgroundColor: "rgba(0,22,45,0.6)", border: "1px solid var(--border)" }}
            >
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={
                    statusFilter === f.value
                      ? { backgroundColor: "var(--spring)", color: "var(--midnight)" }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <Filter size={11} />
              {filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"}
              {selectedExpFilters.length > 0 && <span style={{ color: "var(--spring)" }}>· {selectedExpFilters.join(", ")}</span>}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <AlertCircle size={15} style={{ color: "#EF4444" }} className="flex-shrink-0" />
              <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-xl shimmer" style={{ border: "1px solid var(--border)" }} />)}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Search size={40} style={{ color: "var(--text-muted)" }} />
              <p className="text-base font-medium" style={{ color: "var(--text-secondary)" }}>No jobs found</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {selectedExpFilters.length > 0
                  ? "Try removing experience filters or searching with different keywords"
                  : "Search above or paste a job URL to get started"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} onScore={handleScore} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resume selector modal */}
      {scoreModal && !scoreModal.result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setScoreModal(null)} />
          <div
            className="relative w-full max-w-md rounded-2xl shadow-2xl p-6 fade-in"
            style={{ backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: "var(--praxeti)" }}>Select Resume to Score</h2>
              <button onClick={() => setScoreModal(null)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "rgba(0,22,45,0.7)", border: "1px solid var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Scoring against:</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: "var(--praxeti)" }}>{scoreModal.job.title}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{scoreModal.job.company}</p>
            </div>

            {scoring && (
              <div className="mb-4 flex items-center gap-3 text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(219,230,76,0.08)", border: "1px solid rgba(219,230,76,0.20)", color: "var(--spring)" }}>
                <Loader2 size={14} className="animate-spin flex-shrink-0" />
                Running ATS analysis with Claude AI… ~20–40 seconds
              </div>
            )}

            {resumes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No resumes uploaded yet</p>
                <Link href="/resumes" className="text-xs mt-2 block" style={{ color: "var(--nuit-light)" }}>Upload a resume first →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {resumes.map((resume) => (
                  <button
                    key={resume.id}
                    onClick={() => handleScoreWithResume(resume.id)}
                    disabled={scoring}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all disabled:opacity-50"
                    style={{ backgroundColor: "rgba(0,22,45,0.6)", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = "var(--border-light)"; el.style.backgroundColor = "var(--midnight-hover)"; }}
                    onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = "var(--border)"; el.style.backgroundColor = "rgba(0,22,45,0.6)"; }}
                  >
                    <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ backgroundColor: "rgba(219,230,76,0.12)", border: "1px solid rgba(219,230,76,0.25)", color: "var(--spring)" }}>
                      {resume.category}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--praxeti)" }}>{resume.filename}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{resume.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ATS result modal */}
      {scoreModal?.result && scoreModal.applicationId !== undefined && (
        <ATSScoreModal result={scoreModal.result} applicationId={scoreModal.applicationId} onClose={() => setScoreModal(null)} />
      )}
    </div>
  );
}
