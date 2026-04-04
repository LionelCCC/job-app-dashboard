"use client";

import { useState } from "react";
import {
  MapPin,
  Calendar,
  ExternalLink,
  Zap,
  Trash2,
  Building2,
  Globe,
} from "lucide-react";
import clsx from "clsx";
import { Job, JobType, getJobTypeBadgeClass, getScoreBg, formatDate } from "@/lib/api";

interface JobCardProps {
  job: Job;
  onScore?: (job: Job) => void;
  onDelete?: (id: number) => void;
  showScore?: boolean;
}

const sourceIcons: Record<string, React.ReactNode> = {
  LinkedIn: <Globe size={12} />,
  Indeed: <Globe size={12} />,
};

export default function JobCard({
  job,
  onScore,
  onDelete,
  showScore = true,
}: JobCardProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(job.id);
    } finally {
      setDeleting(false);
    }
  };

  const statusColors: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    scored: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    applied: "bg-green-500/10 text-green-400 border-green-500/30",
  };

  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 hover:border-slate-600 transition-all duration-200 group flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Company logo placeholder */}
        <div className="w-10 h-10 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0 text-slate-300">
          <Building2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-100 truncate leading-tight">
                {job.title}
              </h3>
              <p className="text-sm text-slate-400 truncate">{job.company}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={clsx("badge text-xs", getJobTypeBadgeClass(job.job_type as JobType))}>
                {job.job_type}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {job.location && (
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            <span className="truncate max-w-[120px]">{job.location}</span>
          </span>
        )}
        {job.created_at && (
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(job.created_at)}
          </span>
        )}
        {job.source && (
          <span className="flex items-center gap-1">
            {sourceIcons[job.source] || <Globe size={12} />}
            {job.source}
          </span>
        )}
      </div>

      {/* Description preview */}
      {job.description && (
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
          {job.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "badge border text-xs",
              statusColors[job.status] || statusColors.new
            )}
          >
            {job.status}
          </span>
          {showScore && job.ats_score !== undefined && (
            <span
              className={clsx(
                "badge border text-xs font-semibold",
                getScoreBg(job.ats_score)
              )}
            >
              ATS: {job.ats_score}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              title="View job posting"
            >
              <ExternalLink size={14} />
            </a>
          )}
          {onScore && (
            <button
              onClick={() => onScore(job)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-medium transition-colors"
            >
              <Zap size={12} />
              Score
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
              title="Delete job"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
