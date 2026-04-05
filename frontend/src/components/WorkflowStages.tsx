"use client";

/**
 * WorkflowStages — large clickable stage cards that show where the user is in
 * the pipeline: Resume → Discovery → Scoring → Application.
 *
 * Props:
 *   resumeCount   number of uploaded resumes (0 = gate)
 *   jobCount      number of discovered / shortlisted jobs
 *   scoredCount   number of scored applications
 *   appliedCount  number of submitted applications
 *   activeStage   which stage the user is currently on (highlights the card)
 */

import Link from "next/link";
import { FileText, Briefcase, Target, Send, ArrowRight, Lock } from "lucide-react";

export type PipelineStage = "resume" | "discovery" | "scoring" | "application";

interface StageConfig {
  id: PipelineStage;
  step: number;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  href: string;
}

const STAGES: StageConfig[] = [
  {
    id: "resume",
    step: 1,
    label: "Resume",
    sublabel: "Upload & parse",
    icon: FileText,
    href: "/resumes",
  },
  {
    id: "discovery",
    step: 2,
    label: "Discovery",
    sublabel: "Find & shortlist",
    icon: Briefcase,
    href: "/jobs",
  },
  {
    id: "scoring",
    step: 3,
    label: "Scoring",
    sublabel: "ATS analysis",
    icon: Target,
    href: "/scoring",
  },
  {
    id: "application",
    step: 4,
    label: "Application",
    sublabel: "Apply & track",
    icon: Send,
    href: "/applications",
  },
];

interface WorkflowStagesProps {
  resumeCount?: number;
  jobCount?: number;
  scoredCount?: number;
  appliedCount?: number;
  activeStage?: PipelineStage;
  className?: string;
}

type StageStatus = "complete" | "active" | "pending" | "blocked";

function getStageStatus(
  stage: PipelineStage,
  {
    resumeCount = 0,
    jobCount = 0,
    scoredCount = 0,
    appliedCount = 0,
    activeStage,
  }: WorkflowStagesProps
): StageStatus {
  const hasResume = resumeCount > 0;

  if (activeStage === stage) return "active";

  switch (stage) {
    case "resume":
      return hasResume ? "complete" : "active"; // always accessible
    case "discovery":
      if (!hasResume) return "blocked";
      return jobCount > 0 ? "complete" : "pending";
    case "scoring":
      if (!hasResume) return "blocked";
      return scoredCount > 0 ? "complete" : "pending";
    case "application":
      if (!hasResume) return "blocked";
      return appliedCount > 0 ? "complete" : "pending";
    default:
      return "pending";
  }
}

function stageCount(
  stage: PipelineStage,
  { resumeCount = 0, jobCount = 0, scoredCount = 0, appliedCount = 0 }: WorkflowStagesProps
): number {
  switch (stage) {
    case "resume":      return resumeCount;
    case "discovery":   return jobCount;
    case "scoring":     return scoredCount;
    case "application": return appliedCount;
    default:            return 0;
  }
}

export default function WorkflowStages(props: WorkflowStagesProps) {
  const { activeStage, className = "" } = props;

  return (
    <div
      className={`flex items-center gap-1 px-6 py-4 ${className}`}
      style={{
        backgroundColor: "var(--midnight-deep)",
        borderBottom: "1px solid rgba(30,72,143,0.30)",
      }}
    >
      {STAGES.map((stage, idx) => {
        const status = getStageStatus(stage.id, props);
        const count = stageCount(stage.id, props);
        const Icon = stage.icon;
        const isBlocked = status === "blocked";
        const isActive = status === "active" || activeStage === stage.id;
        const isComplete = status === "complete";

        const cardStyle: React.CSSProperties = isActive
          ? {
              backgroundColor: "rgba(219,230,76,0.09)",
              borderColor: "var(--spring)",
              color: "var(--spring)",
            }
          : isComplete
          ? {
              backgroundColor: "rgba(116,195,101,0.07)",
              borderColor: "rgba(116,195,101,0.45)",
              color: "var(--mantis)",
            }
          : isBlocked
          ? {
              backgroundColor: "rgba(0,15,31,0.4)",
              borderColor: "rgba(30,72,143,0.15)",
              color: "var(--text-muted)",
              opacity: 0.45,
            }
          : {
              backgroundColor: "var(--midnight-card)",
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            };

        const card = (
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-150 min-w-[9rem] flex-1 max-w-[13rem]"
            style={cardStyle}
          >
            {/* Icon / Lock */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={
                isActive
                  ? { backgroundColor: "rgba(219,230,76,0.20)" }
                  : isComplete
                  ? { backgroundColor: "rgba(116,195,101,0.18)" }
                  : { backgroundColor: "rgba(30,72,143,0.20)" }
              }
            >
              {isBlocked ? (
                <Lock size={13} style={{ color: "var(--text-muted)" }} />
              ) : (
                <Icon
                  size={14}
                  style={{
                    color: isActive
                      ? "var(--spring)"
                      : isComplete
                      ? "var(--mantis)"
                      : "var(--text-muted)",
                  }}
                />
              )}
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs font-semibold leading-tight truncate"
                  style={{
                    color: isActive
                      ? "var(--spring)"
                      : isComplete
                      ? "var(--mantis)"
                      : isBlocked
                      ? "var(--text-muted)"
                      : "var(--praxeti)",
                  }}
                >
                  {stage.label}
                </span>
                {count > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                    style={
                      isActive
                        ? { backgroundColor: "rgba(219,230,76,0.20)", color: "var(--spring)" }
                        : isComplete
                        ? { backgroundColor: "rgba(116,195,101,0.18)", color: "var(--mantis)" }
                        : { backgroundColor: "rgba(30,72,143,0.25)", color: "var(--nuit-light)" }
                    }
                  >
                    {count}
                  </span>
                )}
              </div>
              <p
                className="text-[10px] leading-tight truncate mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {stage.sublabel}
              </p>
            </div>
          </div>
        );

        return (
          <div key={stage.id} className="flex items-center gap-1 flex-1 max-w-[14rem]">
            {isBlocked ? (
              <div className="w-full cursor-not-allowed">{card}</div>
            ) : (
              <Link href={stage.href} className="w-full group hover:no-underline">
                {card}
              </Link>
            )}
            {idx < STAGES.length - 1 && (
              <ArrowRight
                size={14}
                className="flex-shrink-0 mx-0.5"
                style={{ color: "rgba(30,72,143,0.50)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
