"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle,
  Send,
  X,
  Clock,
  Search,
  XCircle,
  Zap,
  Play,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import ATSScoreModal from "@/components/ATSScoreModal";
import ResumeEditor from "@/components/ResumeEditor";
import {
  fetchApplications,
  fetchResumes,
  analyzeResume,
  editResume,
  approveEdit,
  applyToJob,
  updateApplicationStatus,
  Application,
  ApplicationStatus,
  ATSResult,
  Resume,
  JobType,
  getScoreBg,
  getJobTypeBadgeClass,
  formatDate,
} from "@/lib/api";

// ─── Column config ────────────────────────────────────────────────────────────

interface ColumnDef {
  id: ApplicationStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "to_apply",
    label: "To Apply",
    icon: Clock,
    color: "text-blue-400",
    borderColor: "border-blue-500/30",
  },
  {
    id: "reviewing",
    label: "Reviewing",
    icon: Search,
    color: "text-yellow-400",
    borderColor: "border-yellow-500/30",
  },
  {
    id: "applying",
    label: "Applying",
    icon: Send,
    color: "text-indigo-400",
    borderColor: "border-indigo-500/30",
  },
  {
    id: "submitted",
    label: "Submitted",
    icon: CheckCircle,
    color: "text-green-400",
    borderColor: "border-green-500/30",
  },
  {
    id: "failed",
    label: "Failed",
    icon: XCircle,
    color: "text-red-400",
    borderColor: "border-red-500/30",
  },
];

// ─── Apply progress modal ─────────────────────────────────────────────────────

function ApplyProgressModal({
  applicationId,
  onDone,
  onClose,
}: {
  applicationId: number;
  onDone: (fields: string[]) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"pending" | "running" | "done" | "error">("pending");
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentField, setCurrentField] = useState<string | null>(null);

  const run = useCallback(async () => {
    setStatus("running");
    try {
      // Simulate progressive field filling with fake delays for UX
      const result = await applyToJob(applicationId);
      // Animate through fields
      for (let i = 0; i < result.fields_filled.length; i++) {
        setCurrentField(result.fields_filled[i]);
        setFields(result.fields_filled.slice(0, i + 1));
        await new Promise((r) => setTimeout(r, 200));
      }
      setStatus("done");
      onDone(result.fields_filled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application failed");
      setStatus("error");
    }
  }, [applicationId, onDone]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={status !== "running" ? onClose : undefined} />
      <div className="relative w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-100">
            {status === "done"
              ? "Application Submitted!"
              : status === "error"
              ? "Application Failed"
              : "Submitting Application..."}
          </h2>
          {(status === "done" || status === "error") && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-center py-6">
          {status === "running" && (
            <div className="text-center">
              <Loader2
                size={40}
                className="text-indigo-400 animate-spin mx-auto mb-3"
              />
              <p className="text-sm text-slate-400">
                Filling application fields...
              </p>
              {currentField && (
                <p className="text-xs text-indigo-400 mt-1">{currentField}</p>
              )}
            </div>
          )}
          {status === "done" && (
            <div className="text-center">
              <CheckCircle
                size={48}
                className="text-green-400 mx-auto mb-3"
              />
              <p className="text-sm text-green-400 font-medium">
                Successfully submitted!
              </p>
            </div>
          )}
          {status === "error" && (
            <div className="text-center">
              <AlertCircle size={48} className="text-red-400 mx-auto mb-3" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Fields filled */}
        {fields.length > 0 && (
          <div className="border border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 mb-2">
              Fields filled ({fields.length}):
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {fields.map((field, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <CheckCircle size={11} className="text-green-400 flex-shrink-0" />
                  <span className="text-slate-300">{field}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status !== "running" && (
          <button
            onClick={onClose}
            className={clsx(
              "mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition-colors",
              status === "done"
                ? "bg-green-600 hover:bg-green-500 text-white"
                : "bg-slate-700 hover:bg-slate-600 text-slate-300"
            )}
          >
            {status === "done" ? "Done" : "Close"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({
  app,
  onScore,
  onApply,
  onStatusChange,
}: {
  app: Application;
  onScore: (app: Application) => void;
  onApply: (app: Application) => void;
  onStatusChange: (id: number, status: ApplicationStatus) => void;
}) {
  const score = app.ats_score ?? app.ats_result?.overall_score;
  const job = app.job;

  return (
    <div className="bg-slate-800/90 border border-slate-700/60 rounded-xl p-4 hover:border-slate-600 transition-all flex flex-col gap-2.5">
      {/* Job */}
      <div>
        <p className="text-sm font-semibold text-slate-100 truncate leading-tight">
          {job?.title ?? `Application #${app.id}`}
        </p>
        <p className="text-xs text-slate-400 truncate">{job?.company ?? "Unknown"}</p>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {job?.job_type && (
          <span className={clsx("badge text-xs", getJobTypeBadgeClass(job.job_type as JobType))}>
            {job.job_type}
          </span>
        )}
        {score !== undefined ? (
          <span className={clsx("badge border text-xs font-semibold", getScoreBg(score))}>
            {score}%
          </span>
        ) : (
          <span className="badge bg-slate-700/40 text-slate-600 border border-slate-600/30 text-xs">
            Unscored
          </span>
        )}
        <span className="text-xs text-slate-600 ml-auto">
          {formatDate(app.applied_at || app.created_at)}
        </span>
      </div>

      {/* Resume used */}
      {app.resume && (
        <p className="text-xs text-slate-600 truncate">
          {app.resume.filename}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          onClick={() => onScore(app)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-600/15 text-indigo-400 border border-indigo-500/25 hover:bg-indigo-600/25 text-xs font-medium transition-colors flex-1 justify-center"
        >
          <Zap size={11} />
          {score !== undefined ? "Re-score" : "Score"}
        </button>
        {app.status !== "submitted" && app.status !== "failed" && (
          <button
            onClick={() => onApply(app)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-green-600/15 text-green-400 border border-green-500/25 hover:bg-green-600/25 text-xs font-medium transition-colors flex-1 justify-center"
          >
            <Play size={11} />
            Apply
          </button>
        )}
        {job?.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Move to failed */}
      {app.status !== "failed" && app.status !== "submitted" && (
        <button
          onClick={() => onStatusChange(app.id, "failed")}
          className="text-xs text-slate-600 hover:text-red-400 transition-colors text-left"
        >
          Mark as failed
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Score modal
  const [scoreModal, setScoreModal] = useState<{
    app: Application;
    result?: ATSResult;
    applicationId?: number;
  } | null>(null);
  const [scoringAppId, setScoringAppId] = useState<number | null>(null);

  // Resume selector for scoring
  const [resumeSelectorApp, setResumeSelectorApp] = useState<Application | null>(null);

  // Edit modal
  const [editModal, setEditModal] = useState<{
    applicationId: number;
    diff: string;
    editedContent: string;
  } | null>(null);
  const [editingAppId, setEditingAppId] = useState<number | null>(null);

  // Apply modal
  const [applyModal, setApplyModal] = useState<Application | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [apps, res] = await Promise.all([
        fetchApplications(),
        fetchResumes(),
      ]);
      setApplications(apps);
      setResumes(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load applications"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScore = (app: Application) => {
    // If app already has a resume, score directly; otherwise show selector
    if (app.resume_id) {
      doScore(app, app.resume_id);
    } else {
      setResumeSelectorApp(app);
    }
  };

  const doScore = async (app: Application, resumeId: number) => {
    setScoringAppId(app.id);
    setResumeSelectorApp(null);
    try {
      const result = await analyzeResume(app.job_id, resumeId);
      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id
            ? { ...a, ats_score: result.overall_score, ats_result: result }
            : a
        )
      );
      setScoreModal({
        app: { ...app, ats_score: result.overall_score },
        result,
        applicationId: result.application_id,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoringAppId(null);
    }
  };

  const handleEditFromScore = async (applicationId: number) => {
    setEditingAppId(applicationId);
    try {
      const result = await editResume(applicationId);
      setScoreModal(null);
      setEditModal({ applicationId, diff: result.suggestions?.join("\n") || "", editedContent: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Edit failed");
    } finally {
      setEditingAppId(null);
    }
  };

  const handleApproveEdit = async () => {
    if (!editModal) return;
    await approveEdit(editModal.applicationId);
    setEditModal(null);
    // Trigger apply
    const app = applications.find(
      (a) => a.id === editModal.applicationId
    );
    if (app) {
      setApplyModal(app);
    }
  };

  const handleApply = (app: Application) => {
    setApplyModal(app);
  };

  const handleApplyDone = (fields: string[]) => {
    if (!applyModal) return;
    setApplications((prev) =>
      prev.map((a) =>
        a.id === applyModal.id
          ? { ...a, status: "submitted", fields_filled: fields }
          : a
      )
    );
  };

  const handleStatusChange = async (
    id: number,
    status: ApplicationStatus
  ) => {
    try {
      const updated = await updateApplicationStatus(id, status);
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updated, status } : a))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }
  };

  const byStatus = (status: ApplicationStatus) =>
    applications.filter((a) => a.status === status);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Application Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track and manage your job applications
          </p>
        </div>
        <button
          onClick={() => loadData()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-sm transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Kanban */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              className="flex-shrink-0 w-72 h-96 bg-slate-800 rounded-xl shimmer border border-slate-700/50"
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colApps = byStatus(col.id);
            const Icon = col.icon;

            return (
              <div
                key={col.id}
                className="flex-shrink-0 w-72 flex flex-col gap-3"
              >
                {/* Column header */}
                <div
                  className={clsx(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl border bg-slate-800/60",
                    col.borderColor
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={col.color} />
                    <span className="text-sm font-semibold text-slate-200">
                      {col.label}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      "text-xs font-bold px-2 py-0.5 rounded-full",
                      colApps.length > 0
                        ? `${col.color} bg-current/10`
                        : "text-slate-600"
                    )}
                    style={{ backgroundColor: colApps.length > 0 ? undefined : undefined }}
                  >
                    <span
                      className={clsx(
                        "px-1.5 py-0.5 rounded-full text-xs font-bold",
                        colApps.length > 0
                          ? col.color
                          : "text-slate-600"
                      )}
                    >
                      {colApps.length}
                    </span>
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 min-h-[100px]">
                  {colApps.length === 0 ? (
                    <div className="border border-dashed border-slate-700/50 rounded-xl p-6 text-center text-slate-700 text-xs">
                      No applications
                    </div>
                  ) : (
                    colApps.map((app) => (
                      <div key={app.id} className="relative">
                        {scoringAppId === app.id && (
                          <div className="absolute inset-0 z-10 bg-slate-800/80 rounded-xl flex items-center justify-center">
                            <Loader2
                              size={20}
                              className="text-indigo-400 animate-spin"
                            />
                          </div>
                        )}
                        <KanbanCard
                          app={app}
                          onScore={handleScore}
                          onApply={handleApply}
                          onStatusChange={handleStatusChange}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resume selector modal */}
      {resumeSelectorApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setResumeSelectorApp(null)}
          />
          <div className="relative w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-100">
                Select Resume
              </h2>
              <button
                onClick={() => setResumeSelectorApp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {resumes.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                No resumes. Upload one first.
              </p>
            ) : (
              <div className="space-y-2">
                {resumes.map((resume) => (
                  <button
                    key={resume.id}
                    onClick={() => doScore(resumeSelectorApp, resume.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-700/40 border border-slate-600/50 hover:bg-slate-700/70 text-left transition-all"
                  >
                    <span
                      className={clsx(
                        "badge flex-shrink-0",
                        getJobTypeBadgeClass(resume.category)
                      )}
                    >
                      {resume.category}
                    </span>
                    <span className="text-sm text-slate-200 truncate">
                      {resume.filename}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ATS Score modal */}
      {scoreModal?.result && scoreModal.applicationId !== undefined && (
        <ATSScoreModal
          result={scoreModal.result}
          applicationId={scoreModal.applicationId}
          onClose={() => setScoreModal(null)}
          onEditApproved={async () => {
            if (scoreModal.applicationId !== undefined) {
              await handleEditFromScore(scoreModal.applicationId);
            }
          }}
        />
      )}

      {/* Resume editor / diff modal */}
      {editModal && (
        <ResumeEditor
          diff={editModal.diff}
          editedContent={editModal.editedContent}
          onApprove={handleApproveEdit}
          onDiscard={() => setEditModal(null)}
        />
      )}

      {/* Apply progress modal */}
      {applyModal && (
        <ApplyProgressModal
          applicationId={applyModal.id}
          onDone={handleApplyDone}
          onClose={() => setApplyModal(null)}
        />
      )}
    </div>
  );
}
