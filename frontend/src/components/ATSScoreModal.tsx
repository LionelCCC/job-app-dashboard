"use client";

import { useState } from "react";
import { X, CheckCircle, XCircle, Lightbulb, Wand2, Loader2 } from "lucide-react";
import clsx from "clsx";
import { ATSResult, editResume, getScoreColor } from "@/lib/api";

interface ATSScoreModalProps {
  result: ATSResult;
  applicationId: number;
  onClose: () => void;
  onEditApproved?: () => void;
}

// Circular progress SVG component
function CircularScore({ score }: { score: number }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="120" height="120" className="-rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-xs text-slate-500 font-medium">/ 100</span>
      </div>
    </div>
  );
}

// Score bar component
function ScoreBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const color =
    value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span
          className={clsx(
            "font-semibold",
            getScoreColor(value)
          )}
        >
          {value}%
        </span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function ATSScoreModal({
  result,
  applicationId,
  onClose,
  onEditApproved,
}: ATSScoreModalProps) {
  const [editLoading, setEditLoading] = useState(false);
  const [editResult, setEditResult] = useState<ATSResult | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const handleEdit = async () => {
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await editResume(applicationId);
      setEditResult(res);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to edit resume");
    } finally {
      setEditLoading(false);
    }
  };

  const breakdown = result.breakdown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-slate-100">
            ATS Analysis Result
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="p-6 space-y-6">
            {/* Score overview */}
            <div className="flex items-center gap-8">
              <CircularScore score={result.overall_score} />
              <div className="flex-1 space-y-3">
                <ScoreBar
                  label="Keyword Match"
                  value={breakdown?.keyword_score ?? 0}
                />
                <ScoreBar
                  label="Experience Match"
                  value={breakdown?.experience_score ?? 0}
                />
                <ScoreBar
                  label="Education Match"
                  value={breakdown?.education_score ?? 0}
                />
                <ScoreBar
                  label="Skills Match"
                  value={breakdown?.skills_score ?? 0}
                />
              </div>
            </div>

            {/* Keywords */}
            <div className="grid grid-cols-2 gap-4">
              {/* Matched */}
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={15} className="text-green-400" />
                  <h3 className="text-sm font-medium text-slate-300">
                    Matched ({result.matched_keywords?.length ?? 0})
                  </h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.matched_keywords?.length ? (
                    result.matched_keywords.map((kw) => (
                      <span
                        key={kw}
                        className="badge bg-green-500/10 text-green-400 border border-green-500/25 text-xs"
                      >
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">None found</span>
                  )}
                </div>
              </div>

              {/* Missing */}
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle size={15} className="text-red-400" />
                  <h3 className="text-sm font-medium text-slate-300">
                    Missing ({result.missing_keywords?.length ?? 0})
                  </h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.missing_keywords?.length ? (
                    result.missing_keywords.map((kw) => (
                      <span
                        key={kw}
                        className="badge bg-red-500/10 text-red-400 border border-red-500/25 text-xs"
                      >
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">
                      No missing keywords
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Suggestions */}
            {result.suggestions?.length > 0 && (
              <div className="bg-slate-900/50 border border-yellow-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={15} className="text-yellow-400" />
                  <h3 className="text-sm font-medium text-slate-300">
                    Suggestions
                  </h3>
                </div>
                <ul className="space-y-2">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="text-yellow-500 mt-0.5 flex-shrink-0">
                        •
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Edit result diff */}
            {editResult && (
              <div className="bg-slate-900/50 border border-indigo-500/20 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3">
                  AI Resume Edit Preview
                </h3>
                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                  {editResult.suggestions?.join("\n") || "Resume has been edited and optimized for this job."}
                </pre>
                <button
                  onClick={() => {
                    onEditApproved?.();
                    onClose();
                  }}
                  className="mt-3 w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
                >
                  Approve & Apply
                </button>
              </div>
            )}

            {editError && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                {editError}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-sm transition-colors"
          >
            Close
          </button>
          {!editResult && (
            <button
              onClick={handleEdit}
              disabled={editLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {editLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )}
              AI Edit Resume
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
