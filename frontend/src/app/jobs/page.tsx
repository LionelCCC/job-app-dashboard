"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Link2,
  Plus,
  AlertCircle,
  Loader2,
  Filter,
  RefreshCw,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import clsx from "clsx";
import JobCard from "@/components/JobCard";
import ATSScoreModal from "@/components/ATSScoreModal";
import {
  fetchJobs,
  searchJobs,
  addJobUrl,
  deleteJob,
  analyzeResume,
  fetchResumes,
  Job,
  JobType,
  Resume,
  ATSResult,
  SearchParams,
} from "@/lib/api";

const JOB_TYPES: JobType[] = ["SWE", "DE", "DA", "DS", "MLE", "AIE"];
const SOURCES = ["LinkedIn", "Indeed", "Company Boards"] as const;
const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "scored", label: "Scored" },
  { value: "applied", label: "Applied" },
];

function CheckboxGroup<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: T[];
  selected: T[];
  onChange: (vals: T[]) => void;
}) {
  const toggle = (val: T) => {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              active
                ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                : "bg-slate-700/40 text-slate-400 border-slate-600/50 hover:border-slate-500 hover:text-slate-300"
            )}
          >
            {active ? <CheckSquare size={12} /> : <Square size={12} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [addingUrl, setAddingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  // Search form
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<JobType[]>([]);
  const [selectedSources, setSelectedSources] = useState<
    (typeof SOURCES)[number][]
  >([]);

  // URL add
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  // Score modal
  const [scoreModal, setScoreModal] = useState<{
    job: Job;
    resumeId?: number;
    result?: ATSResult;
    applicationId?: number;
  } | null>(null);
  const [scoring, setScoring] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsData, resumesData] = await Promise.all([
        fetchJobs(statusFilter !== "all" ? { status: statusFilter } : {}),
        fetchResumes(),
      ]);
      setJobs(jobsData);
      setResumes(resumesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywords.trim() && selectedTypes.length === 0) return;
    setSearching(true);
    setError(null);
    try {
      const params: SearchParams = {
        keywords: keywords.trim() || undefined,
        location: location.trim() || undefined,
        job_types: selectedTypes.length ? selectedTypes : undefined,
        sources: selectedSources.length
          ? (selectedSources as SearchParams["sources"])
          : undefined,
        limit: 50,
      };
      const { task_id } = await searchJobs(params);
      // Poll or just reload after a delay
      setTimeout(() => loadJobs(), 3000);
      setError(null);
      // Show task started notification
      alert(
        `Search started (task: ${task_id}). Results will appear shortly.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Search failed"
      );
    } finally {
      setSearching(false);
    }
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setAddingUrl(true);
    setUrlError(null);
    try {
      const job = await addJobUrl(urlInput.trim());
      setJobs((prev) => [job, ...prev]);
      setUrlInput("");
    } catch (err) {
      setUrlError(
        err instanceof Error ? err.message : "Failed to add job URL"
      );
    } finally {
      setAddingUrl(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleScore = (job: Job) => {
    setScoreModal({ job });
  };

  const handleScoreWithResume = async (resumeId: number) => {
    if (!scoreModal) return;
    setScoring(true);
    try {
      const result = await analyzeResume(scoreModal.job.id, resumeId);
      setScoreModal((prev) =>
        prev
          ? {
              ...prev,
              resumeId,
              result,
              applicationId: result.application_id,
            }
          : null
      );
      // Update job score in list
      setJobs((prev) =>
        prev.map((j) =>
          j.id === scoreModal.job.id
            ? { ...j, ats_score: result.overall_score, status: "scored" }
            : j
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoring(false);
    }
  };

  const filteredJobs =
    statusFilter === "all"
      ? jobs
      : jobs.filter((j) => j.status === statusFilter);

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Job Discovery</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Search, add, and manage job postings
          </p>
        </div>
        <button
          onClick={() => loadJobs()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-sm transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Search form */}
      <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Search size={15} className="text-indigo-400" />
          Search Jobs
        </h2>
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Keywords + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                Keywords
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. Machine Learning, Python, React..."
                className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-600/60 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, Remote, New York..."
                className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-600/60 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Job types */}
          <div>
            <label className="block text-xs text-slate-500 mb-2">
              Job Types
            </label>
            <CheckboxGroup
              options={JOB_TYPES}
              selected={selectedTypes}
              onChange={setSelectedTypes}
            />
          </div>

          {/* Sources */}
          <div>
            <label className="block text-xs text-slate-500 mb-2">
              Sources
            </label>
            <CheckboxGroup
              options={[...SOURCES]}
              selected={selectedSources}
              onChange={setSelectedSources}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                searching || (!keywords.trim() && selectedTypes.length === 0)
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              {searching ? "Searching..." : "Search Jobs"}
            </button>
          </div>
        </form>
      </div>

      {/* Add URL */}
      <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Link2 size={15} className="text-indigo-400" />
          Add Job by URL
        </h2>
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setUrlError(null);
            }}
            placeholder="https://www.linkedin.com/jobs/view/..."
            className="flex-1 px-3 py-2.5 bg-slate-900/60 border border-slate-600/60 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={handleAddUrl}
            disabled={addingUrl || !urlInput.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {addingUrl ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Add
          </button>
        </div>
        {urlError && (
          <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
            <X size={12} />
            {urlError}
          </p>
        )}
      </div>

      {/* Jobs list */}
      <div>
        {/* Filter bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={clsx(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  statusFilter === f.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter size={12} />
            <span>
              {filteredJobs.length}{" "}
              {filteredJobs.length === 1 ? "job" : "jobs"}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-48 bg-slate-800 rounded-xl shimmer border border-slate-700/50"
              />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-600 gap-3">
            <Search size={40} className="text-slate-700" />
            <p className="text-base font-medium text-slate-500">No jobs found</p>
            <p className="text-sm text-slate-600">
              Try searching with different keywords or add a job URL above
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onScore={handleScore}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Score resume selector modal */}
      {scoreModal && !scoreModal.result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setScoreModal(null)}
          />
          <div className="relative w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">
                Select Resume to Score
              </h2>
              <button
                onClick={() => setScoreModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <p className="text-xs text-slate-500">Scoring against:</p>
              <p className="text-sm font-medium text-slate-200 mt-0.5">
                {scoreModal.job.title}
              </p>
              <p className="text-xs text-slate-400">{scoreModal.job.company}</p>
            </div>

            {resumes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">No resumes uploaded yet</p>
                <a
                  href="/resumes"
                  className="text-xs text-indigo-400 mt-2 block hover:text-indigo-300"
                >
                  Upload a resume first
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {resumes.map((resume) => (
                  <button
                    key={resume.id}
                    onClick={() => handleScoreWithResume(resume.id)}
                    disabled={scoring}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-700/40 border border-slate-600/50 hover:bg-slate-700/70 hover:border-slate-500 text-left transition-all disabled:opacity-50"
                  >
                    {scoring ? (
                      <Loader2
                        size={16}
                        className="text-indigo-400 animate-spin flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400 text-xs font-bold">
                        {resume.category}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {resume.filename}
                      </p>
                      <p className="text-xs text-slate-500">{resume.category}</p>
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
        <ATSScoreModal
          result={scoreModal.result}
          applicationId={scoreModal.applicationId}
          onClose={() => setScoreModal(null)}
        />
      )}
    </div>
  );
}
