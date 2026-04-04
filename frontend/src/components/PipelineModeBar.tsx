"use client";

/**
 * PipelineModeBar — Manual / Auto toggle for each pipeline stage.
 *
 * Modes are persisted in localStorage under the key "pipeline_modes".
 * No backend call is needed — the toggle only controls UI behaviour:
 *
 *  Discovery  OFF = search only when user clicks "Search"
 *             ON  = also auto-runs site monitor checks and pre-fills search
 *
 *  Scoring    OFF = user clicks "Score" per job manually
 *             ON  = new jobs that arrive are auto-scored against the best-
 *                   matching resume (by category) without clicking
 *
 *  Apply      OFF = user reviews and manually clicks "Apply"
 *             ON  = score ≥ threshold (80) + human_approved → auto-apply
 *                   (still shows confirmation + result)
 *
 * The component broadcasts changes via a custom event "pipeline_mode_change"
 * so other pages can react without prop drilling.
 */

import { useEffect, useState } from "react";
import { Zap, Search, Brain, Send } from "lucide-react";
import clsx from "clsx";

export type PipelineMode = "manual" | "auto";

export interface PipelineModes {
  discovery: PipelineMode;
  scoring: PipelineMode;
  apply: PipelineMode;
}

const STORAGE_KEY = "pipeline_modes";

const DEFAULT_MODES: PipelineModes = {
  discovery: "manual",
  scoring: "manual",
  apply: "manual",
};

export function getPipelineModes(): PipelineModes {
  if (typeof window === "undefined") return DEFAULT_MODES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_MODES, ...JSON.parse(stored) };
  } catch {
    // corrupt storage — fall through
  }
  return DEFAULT_MODES;
}

function savePipelineModes(modes: PipelineModes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modes));
    window.dispatchEvent(
      new CustomEvent("pipeline_mode_change", { detail: modes })
    );
  } catch {
    // ignore
  }
}

interface StageToggleProps {
  icon: React.ElementType;
  label: string;
  stage: keyof PipelineModes;
  value: PipelineMode;
  onChange: (stage: keyof PipelineModes, mode: PipelineMode) => void;
}

function StageToggle({
  icon: Icon,
  label,
  stage,
  value,
  onChange,
}: StageToggleProps) {
  const isAuto = value === "auto";
  return (
    <div className="flex items-center gap-2.5">
      <Icon
        size={13}
        className={clsx(isAuto ? "text-indigo-400" : "text-slate-500")}
      />
      <span
        className={clsx(
          "text-xs font-medium",
          isAuto ? "text-slate-200" : "text-slate-500"
        )}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(stage, isAuto ? "manual" : "auto")}
        title={`${label}: ${isAuto ? "Auto (click to switch to Manual)" : "Manual (click to switch to Auto)"}`}
        className={clsx(
          "relative w-9 h-5 rounded-full transition-colors duration-200",
          isAuto ? "bg-indigo-600" : "bg-slate-600/70"
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
            isAuto ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </button>
      <span
        className={clsx(
          "text-xs",
          isAuto ? "text-indigo-400" : "text-slate-600"
        )}
      >
        {isAuto ? "AUTO" : "OFF"}
      </span>
    </div>
  );
}

export default function PipelineModeBar() {
  const [modes, setModes] = useState<PipelineModes>(DEFAULT_MODES);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setModes(getPipelineModes());
    setMounted(true);
  }, []);

  const handleChange = (stage: keyof PipelineModes, mode: PipelineMode) => {
    const updated = { ...modes, [stage]: mode };
    setModes(updated);
    savePipelineModes(updated);
  };

  const anyAuto = Object.values(modes).some((m) => m === "auto");

  if (!mounted) return null; // avoid SSR hydration mismatch

  return (
    <div
      className={clsx(
        "flex items-center gap-4 px-4 py-2 border-b transition-colors",
        anyAuto
          ? "bg-indigo-950/40 border-indigo-800/40"
          : "bg-slate-900/60 border-slate-800/60"
      )}
    >
      {/* Label */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Zap
          size={12}
          className={clsx(anyAuto ? "text-indigo-400" : "text-slate-600")}
        />
        <span className="text-xs text-slate-500 font-medium">Pipeline</span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-slate-700/60" />

      {/* Toggles */}
      <div className="flex items-center gap-5 flex-wrap">
        <StageToggle
          icon={Search}
          label="Discovery"
          stage="discovery"
          value={modes.discovery}
          onChange={handleChange}
        />
        <StageToggle
          icon={Brain}
          label="Scoring"
          stage="scoring"
          value={modes.scoring}
          onChange={handleChange}
        />
        <StageToggle
          icon={Send}
          label="Apply"
          stage="apply"
          value={modes.apply}
          onChange={handleChange}
        />
      </div>

      {/* Info */}
      {anyAuto && (
        <span className="ml-auto text-xs text-indigo-500/70 hidden md:block">
          Auto-mode is active — stages will run without manual triggers
        </span>
      )}
    </div>
  );
}
