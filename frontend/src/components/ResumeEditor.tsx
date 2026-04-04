"use client";

import { useState } from "react";
import { X, Check, FileText, Loader2, ArrowRight } from "lucide-react";
import clsx from "clsx";

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNum?: number;
}

interface ResumeEditorProps {
  diff: string;
  originalContent?: string;
  editedContent?: string;
  onApprove: () => Promise<void>;
  onDiscard: () => void;
}

function parseDiff(diffStr: string): DiffLine[] {
  if (!diffStr) return [];
  const lines = diffStr.split("\n");
  return lines.map((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      return { type: "added", content: line.slice(1) };
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      return { type: "removed", content: line.slice(1) };
    } else {
      return {
        type: "unchanged",
        content: line.startsWith(" ") ? line.slice(1) : line,
      };
    }
  });
}

export default function ResumeEditor({
  diff,
  originalContent,
  editedContent,
  onApprove,
  onDiscard,
}: ResumeEditorProps) {
  const [approving, setApproving] = useState(false);
  const [view, setView] = useState<"diff" | "split">("diff");

  const diffLines = parseDiff(diff);
  const addedCount = diffLines.filter((l) => l.type === "added").length;
  const removedCount = diffLines.filter((l) => l.type === "removed").length;

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onDiscard}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">
              AI Resume Edit Preview
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                +{addedCount} added
              </span>
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                -{removedCount} removed
              </span>
            </div>
            {/* View toggle */}
            {originalContent && editedContent && (
              <div className="flex bg-slate-700 rounded-lg p-0.5">
                <button
                  onClick={() => setView("diff")}
                  className={clsx(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    view === "diff"
                      ? "bg-slate-600 text-slate-100"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  Diff
                </button>
                <button
                  onClick={() => setView("split")}
                  className={clsx(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    view === "split"
                      ? "bg-slate-600 text-slate-100"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  Split
                </button>
              </div>
            )}
            <button
              onClick={onDiscard}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {view === "diff" || (!originalContent && !editedContent) ? (
            <div className="font-mono text-xs leading-relaxed">
              {diffLines.length > 0 ? (
                diffLines.map((line, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "px-6 py-0.5 flex items-start gap-3 border-l-2",
                      line.type === "added"
                        ? "bg-green-500/10 border-green-500 text-green-300"
                        : line.type === "removed"
                        ? "bg-red-500/10 border-red-500 text-red-300 line-through"
                        : "border-transparent text-slate-400"
                    )}
                  >
                    <span
                      className={clsx(
                        "w-4 flex-shrink-0 select-none",
                        line.type === "added"
                          ? "text-green-500"
                          : line.type === "removed"
                          ? "text-red-500"
                          : "text-slate-600"
                      )}
                    >
                      {line.type === "added"
                        ? "+"
                        : line.type === "removed"
                        ? "-"
                        : " "}
                    </span>
                    <span className="whitespace-pre-wrap break-words min-w-0">
                      {line.content || "\u00A0"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center text-slate-500">
                  <p>No diff available. Showing edited content.</p>
                  <pre className="mt-4 text-left text-xs text-slate-400 whitespace-pre-wrap">
                    {editedContent || "No content"}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            /* Split view */
            <div className="grid grid-cols-2 divide-x divide-slate-700">
              <div className="p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Original
                </p>
                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
                  {originalContent}
                </pre>
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold text-green-500/70 uppercase tracking-wider mb-3">
                  Edited
                </p>
                <pre className="text-xs text-green-300/80 whitespace-pre-wrap font-mono leading-relaxed">
                  {editedContent}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between gap-3 bg-slate-800/50">
          <div className="text-xs text-slate-500">
            Review the changes carefully before approving
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDiscard}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-sm transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {approving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Approve & Apply
              {!approving && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
