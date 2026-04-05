"use client";

/**
 * Scoring page — Stage 3 of the pipeline.
 * Shows all jobs with ATS analysis controls and results.
 * Prerequisites: resume uploaded + jobs discovered.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Target, FileText, Briefcase, AlertCircle, Loader2,
  RefreshCw, ArrowRight, ChevronDown,
  ChevronUp, Lock, Upload, Search,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import WorkflowStages from "@/components/WorkflowStages";
import {
  fetchJobs, fetchResumes, fetchApplications, analyzeResume,
  Job, Resume, Application, getScoreBg,
  getJobTypeBadgeClass,
} from "@/lib/api";

// ─── Resume selector ──────────────────────────────────────────────────────────
function ResumeSelector({
  resumes, selected, onChange,
}: { resumes: Resume[]; selected: number | null; onChange: (id: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {resumes.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          style={
            selected === r.id
              ? { backgroundColor: "rgba(219,230,76,0.12)", border: "1px solid rgba(219,230,76,0.35)", color: "var(--spring)" }
              : { backgroundColor: "var(--midnight)", border: "1px solid var(--border)", color: "var(--text-secondary)" }
          }
        >
          <FileText size={13} />
          <span>{r.filename}</span>
          <span className={`badge text-[10px] ${getJobTypeBadgeClass(r.category)}`}>{r.category}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return null;
  const pct = Math.round(value);
  const color = pct >= 80 ? "var(--mantis)" : pct >= 60 ? "#FBBF24" : "#EF4444";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ─── Job scoring card ─────────────────────────────────────────────────────────
interface JobScoringCardProps {
  job: Job;
  resume: Resume | null;
  existingApp: Application | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onScore: (jobId: number, resumeId: number) => Promise<any>;
  onViewResult: () => void;
  scoring: boolean;
}

function JobScoringCard({ job, resume, existingApp, onScore, onViewResult, scoring }: JobScoringCardProps) {
  const [expanded, setExpanded] = useState(false);
  const score = existingApp?.ats_score ?? existingApp?.ats_result?.overall_score;
  const hasResult = score !== undefined;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--midnight-card)",
        border: `1px solid ${hasResult && score! >= 70 ? "rgba(116,195,101,0.35)" : "var(--border)"}`,
      }}
    >
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Job type badge */}
        <div className="flex-shrink-0 mt-0.5">
          <span className={getJobTypeBadgeClass(job.job_type)}>{job.job_type}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--praxeti)" }}>{job.title}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>{job.company}</p>
          {job.location && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{job.location}</p>}
        </div>

        {/* Score or score button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasResult ? (
            <>
              <span className={clsx("badge border text-sm font-bold px-2.5 py-1", getScoreBg(score!))}>{score}%</span>
              {existingApp?.ats_result && (
                <button
                  onClick={() => onViewResult()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: "rgba(30,72,143,0.18)", border: "1px solid var(--border)", color: "var(--nuit-light)" }}
                >
                  View Details
                </button>
              )}
              <button
                onClick={() => setExpanded((p) => !p)}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgba(30,72,143,0.12)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </>
          ) : (
            <button
              onClick={() => resume && onScore(job.id, resume.id)}
              disabled={!resume || scoring}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ backgroundColor: "var(--spring)", color: "var(--midnight)" }}
              title={!resume ? "Select a resume first" : ""}
            >
              {scoring ? <Loader2 size={12} className="animate-spin" /> : <Target size={12} />}
              {scoring ? "Scoring…" : "Score"}
            </button>
          )}
        </div>
      </div>

      {/* Expanded score breakdown */}
      {expanded && hasResult && existingApp?.ats_result && (
        <div
          className="px-5 pb-4 pt-3 space-y-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <ScoreBar label="Keywords"   value={existingApp.ats_result.breakdown?.keyword_score} />
            <ScoreBar label="Experience" value={existingApp.ats_result.breakdown?.experience_score} />
            <ScoreBar label="Education"  value={existingApp.ats_result.breakdown?.education_score} />
            <ScoreBar label="Skills"     value={existingApp.ats_result.breakdown?.skills_score} />
          </div>
          {existingApp.ats_result.missing_keywords?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Missing Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {existingApp.ats_result.missing_keywords.slice(0, 8).map((kw) => (
                  <span key={kw} className="px-2 py-0.5 rounded-full text-[11px]" style={{ backgroundColor: "rgba(239,68,68,0.10)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.22)" }}>{kw}</span>
                ))}
              </div>
            </div>
          )}
          {existingApp.ats_result.suggestions?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Top Suggestions</p>
              <ul className="space-y-1">
                {existingApp.ats_result.suggestions.slice(0, 3).map((s, i) => (
                  <li key={i} className="text-xs flex gap-2" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--spring)" }}>→</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ScoringPage() {
  const [jobs, setJobs]         = useState<Job[]>([]);
  const [resumes, setResumes]   = useState<Resume[]>([]);
  const [apps, setApps]         = useState<Application[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<number | null>(null);
  const [scoringJob, setScoringJob] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [j, r, a] = await Promise.all([fetchJobs(), fetchResumes(), fetchApplications()]);
      setJobs(j);
      setResumes(r);
      setApps(a);
      if (r.length > 0 && !selectedResume) setSelectedResume(r[0].id);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedResume]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Score a job
  const handleScore = async (jobId: number, resumeId: number) => {
    setScoringJob(jobId);
    try {
      const result = await analyzeResume(jobId, resumeId);
      // Refresh applications to pick up the new result
      const newApps = await fetchApplications();
      setApps(newApps);
      // Also update job status
      const newJobs = await fetchJobs();
      setJobs(newJobs);
      return result;
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Scoring failed");
    } finally {
      setScoringJob(null);
    }
  };

  const getAppForJob = (jobId: number): Application | null =>
    apps.find((a) => a.job_id === jobId && a.resume_id === selectedResume) ?? null;

  const selectedResumeObj = resumes.find((r) => r.id === selectedResume) ?? null;
  const scoredJobs   = jobs.filter((j) => getAppForJob(j.id)?.ats_score !== undefined);
  const unscoredJobs = jobs.filter((j) => getAppForJob(j.id)?.ats_score === undefined);

  const cardStyle: React.CSSProperties = { backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)", borderRadius: "0.875rem", padding: "1.25rem" };

  if (loading) {
    return (
      <div>
        <WorkflowStages resumeCount={0} jobCount={0} scoredCount={0} appliedCount={0} activeStage="scoring" />
        <div className="p-8 space-y-4 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl shimmer" />)}
        </div>
      </div>
    );
  }

  // Gate: no resumes
  if (resumes.length === 0) {
    return (
      <div>
        <WorkflowStages resumeCount={0} jobCount={jobs.length} scoredCount={0} appliedCount={0} activeStage="scoring" />
        <div className="p-8 flex flex-col items-center justify-center py-20 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(219,230,76,0.10)", border: "1px solid rgba(219,230,76,0.25)" }}>
            <Lock size={24} style={{ color: "var(--spring)" }} />
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--praxeti)" }}>Resume required</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            Upload a resume first. Scoring compares your resume against each job's requirements.
          </p>
          <Link href="/resumes" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: "var(--spring)", color: "var(--midnight)" }}>
            <Upload size={15} /> Upload Resume
          </Link>
        </div>
      </div>
    );
  }

  // Gate: no jobs
  if (jobs.length === 0) {
    return (
      <div>
        <WorkflowStages resumeCount={resumes.length} jobCount={0} scoredCount={0} appliedCount={0} activeStage="scoring" />
        <div className="p-8 flex flex-col items-center justify-center py-20 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(30,72,143,0.15)", border: "1px solid rgba(30,72,143,0.30)" }}>
            <Briefcase size={24} style={{ color: "var(--nuit-light)" }} />
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--praxeti)" }}>No jobs discovered yet</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            Go to Discovery to search for jobs first. Then come back here to score them.
          </p>
          <Link href="/jobs" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: "var(--nuit)", color: "var(--praxeti)" }}>
            <Search size={15} /> Go to Discovery
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <WorkflowStages
        resumeCount={resumes.length}
        jobCount={jobs.length}
        scoredCount={scoredJobs.length}
        appliedCount={apps.filter((a) => a.status === "submitted").length}
        activeStage="scoring"
      />

      <div className="p-8 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--praxeti)" }}>ATS Scoring</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Analyze how well your resume matches each job's requirements.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <AlertCircle size={16} style={{ color: "#EF4444" }} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>
          </div>
        )}

        {/* Resume selector */}
        <div style={cardStyle}>
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
            Score against which resume?
          </p>
          <ResumeSelector resumes={resumes} selected={selectedResume} onChange={setSelectedResume} />
          {!selectedResume && (
            <p className="text-xs mt-2" style={{ color: "#F59E0B" }}>
              ⚠ Select a resume to enable scoring
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Jobs Available",  value: jobs.length,        color: "nuit"   },
            { label: "Scored",          value: scoredJobs.length,  color: "mantis" },
            { label: "Unscored",        value: unscoredJobs.length, color: "spring" },
          ].map(({ label, value, color }) => {
            const c  = { nuit: "var(--nuit-light)", mantis: "var(--mantis)", spring: "var(--spring)" }[color];
            const bg = { nuit: "rgba(30,72,143,0.15)", mantis: "rgba(116,195,101,0.10)", spring: "rgba(219,230,76,0.10)" }[color];
            return (
              <div key={label} className="text-center py-4 rounded-xl" style={{ backgroundColor: bg, border: `1px solid ${c}33` }}>
                <p className="text-2xl font-bold tabular-nums" style={{ color: c }}>{value}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{label}</p>
              </div>
            );
          })}
        </div>

        {/* Unscored jobs */}
        {unscoredJobs.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
              Ready to Score ({unscoredJobs.length})
            </p>
            <div className="space-y-2.5">
              {unscoredJobs.map((job) => (
                <JobScoringCard
                  key={job.id}
                  job={job}
                  resume={selectedResumeObj}
                  existingApp={getAppForJob(job.id)}
                  onScore={handleScore}
                  onViewResult={() => { /* inline expansion handles details */ }}
                  scoring={scoringJob === job.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Scored jobs */}
        {scoredJobs.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
              Scored ({scoredJobs.length})
            </p>
            <div className="space-y-2.5">
              {scoredJobs
                .sort((a, b) => (getAppForJob(b.id)?.ats_score ?? 0) - (getAppForJob(a.id)?.ats_score ?? 0))
                .map((job) => (
                  <JobScoringCard
                    key={job.id}
                    job={job}
                    resume={selectedResumeObj}
                    existingApp={getAppForJob(job.id)}
                    onScore={handleScore}
                    onViewResult={() => { /* inline expansion handles details */ }}
                    scoring={scoringJob === job.id}
                  />
                ))}
            </div>
          </div>
        )}

        {/* CTA to applications */}
        {scoredJobs.length > 0 && (
          <div
            className="rounded-2xl p-5 flex items-center justify-between"
            style={{ backgroundColor: "rgba(116,195,101,0.08)", border: "1px solid rgba(116,195,101,0.25)" }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--mantis)" }}>
                {scoredJobs.length} job{scoredJobs.length !== 1 ? "s" : ""} scored!
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Ready to review results and submit applications.
              </p>
            </div>
            <Link
              href="/applications"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: "var(--mantis)", color: "var(--midnight)" }}
            >
              Review Applications <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
