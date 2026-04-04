"use client";

import { useState } from "react";
import { Building2, FileText, Zap, ChevronRight, Clock } from "lucide-react";
import clsx from "clsx";
import {
  Application,
  ApplicationStatus,
  JobType,
  getJobTypeBadgeClass,
  getScoreBg,
  formatDate,
} from "@/lib/api";

interface ApplicationCardProps {
  application: Application;
  onScore?: (app: Application) => void;
  onStatusChange?: (id: number, status: ApplicationStatus) => void;
}

const STATUS_NEXT: Partial<Record<ApplicationStatus, ApplicationStatus>> = {
  to_apply: "reviewing",
  reviewing: "applying",
  applying: "submitted",
};

export default function ApplicationCard({
  application,
  onScore,
  onStatusChange,
}: ApplicationCardProps) {
  const [loading, setLoading] = useState(false);

  const job = application.job;
  const resume = application.resume;
  const score = application.ats_score ?? application.ats_result?.overall_score;

  const handleNext = async () => {
    const nextStatus = STATUS_NEXT[application.status];
    if (!nextStatus || !onStatusChange) return;
    setLoading(true);
    try {
      await onStatusChange(application.id, nextStatus);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 hover:border-slate-600 transition-all duration-200 flex flex-col gap-3">
      {/* Job info */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
          <Building2 size={15} className="text-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate leading-tight">
            {job?.title ?? "Unknown Position"}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {job?.company ?? "Unknown Company"}
          </p>
        </div>
        {job?.job_type && (
          <span className={clsx("badge text-xs flex-shrink-0", getJobTypeBadgeClass(job.job_type as JobType))}>
            {job.job_type}
          </span>
        )}
      </div>

      {/* Score + resume row */}
      <div className="flex items-center gap-2 flex-wrap">
        {score !== undefined ? (
          <span className={clsx("badge border text-xs font-semibold", getScoreBg(score))}>
            ATS {score}%
          </span>
        ) : (
          <span className="badge bg-slate-700/50 text-slate-500 text-xs border border-slate-600/50">
            Not scored
          </span>
        )}
        {resume && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <FileText size={11} />
            <span className="truncate max-w-[100px]">{resume.filename}</span>
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-slate-600 ml-auto">
          <Clock size={10} />
          {formatDate(application.applied_at || application.created_at)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-0.5">
        {onScore && (
          <button
            onClick={() => onScore(application)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/15 text-indigo-400 border border-indigo-500/25 hover:bg-indigo-600/25 text-xs font-medium transition-colors flex-1 justify-center"
          >
            <Zap size={11} />
            {score !== undefined ? "Re-score" : "Score"}
          </button>
        )}
        {STATUS_NEXT[application.status] && onStatusChange && (
          <button
            onClick={handleNext}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-700 text-xs font-medium transition-colors flex-1 justify-center disabled:opacity-50"
          >
            {loading ? (
              <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronRight size={12} />
            )}
            {STATUS_NEXT[application.status]?.replace("_", " ")}
          </button>
        )}
      </div>
    </div>
  );
}
