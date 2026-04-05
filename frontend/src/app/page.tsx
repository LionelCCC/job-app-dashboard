"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FileText,
  Briefcase,
  Target,
  Send,
  Upload,
  Search,
  BarChart2,
} from "lucide-react";
import clsx from "clsx";
import WorkflowStages, { PipelineStage } from "@/components/WorkflowStages";
import { fetchStats, fetchResumes, Stats, Resume, formatDate, getScoreBg } from "@/lib/api";

// ─── Determine current recommended stage ─────────────────────────────────────
function detectStage(stats: Stats | null, resumeCount: number): PipelineStage {
  if (!stats) return "resume";
  if (resumeCount === 0) return "resume";
  if (stats.total_jobs === 0) return "discovery";
  if (stats.pipeline.scored === 0) return "scoring";
  return "application";
}

// ─── Next action CTA config ───────────────────────────────────────────────────
interface CTAConfig {
  headline: string;
  description: string;
  buttonLabel: string;
  buttonHref: string;
  color: "spring" | "nuit" | "mantis";
}

function buildCTA(stage: PipelineStage, stats: Stats | null, resumeCount: number): CTAConfig {
  switch (stage) {
    case "resume":
      return {
        headline: "Start by uploading your resume",
        description:
          "JobPilot can't score or apply without a resume. Upload a PDF, DOCX, or LaTeX file and we'll parse it automatically.",
        buttonLabel: "Upload Resume",
        buttonHref: "/resumes",
        color: "spring",
      };
    case "discovery":
      return {
        headline: "Discover relevant jobs",
        description: `You have ${resumeCount} resume${resumeCount > 1 ? "s" : ""} ready. Search LinkedIn, Indeed, or paste a direct URL. Shortlist the roles worth scoring.`,
        buttonLabel: "Go to Discovery",
        buttonHref: "/jobs",
        color: "spring",
      };
    case "scoring":
      return {
        headline: "Score your shortlisted jobs",
        description: `You have ${stats?.total_jobs ?? 0} jobs discovered. Run Claude AI ATS analysis to see how well your resume matches each role.`,
        buttonLabel: "Run Scoring",
        buttonHref: "/scoring",
        color: "nuit",
      };
    case "application":
      return {
        headline: "Apply to scored positions",
        description: `${stats?.pipeline.scored ?? 0} job${(stats?.pipeline.scored ?? 0) !== 1 ? "s" : ""} scored. Review results and submit applications to the best matches.`,
        buttonLabel: "Review Applications",
        buttonHref: "/applications",
        color: "mantis",
      };
  }
}

// ─── Stat mini-card ───────────────────────────────────────────────────────────
function MiniStat({
  label,
  value,
  icon: Icon,
  color = "nuit",
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color?: "spring" | "nuit" | "mantis" | "warning";
}) {
  const iconColors = { spring: "var(--spring)", nuit: "var(--nuit-light)", mantis: "var(--mantis)", warning: "#FBBF24" };
  const bgColors   = { spring: "rgba(219,230,76,0.10)", nuit: "rgba(30,72,143,0.22)", mantis: "rgba(116,195,101,0.10)", warning: "rgba(245,158,11,0.10)" };
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-xl"
      style={{ backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)" }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColors[color] }}>
        <Icon size={18} style={{ color: iconColors[color] }} />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums" style={{ color: "var(--praxeti)" }}>{value}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="p-8 space-y-6 animate-pulse max-w-5xl">
      <div className="h-8 w-64 rounded-lg shimmer" />
      <div className="h-44 rounded-2xl shimmer" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl shimmer" />)}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([fetchStats(), fetchResumes()]);
      setStats(s);
      setResumes(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resumeCount  = resumes.length;
  const currentStage = detectStage(stats, resumeCount);
  const cta          = buildCTA(currentStage, stats, resumeCount);
  const avgScore     = stats?.avg_ats_score ?? 0;

  const ctaBtnStyle: React.CSSProperties =
    cta.color === "spring"
      ? { backgroundColor: "var(--spring)", color: "var(--midnight)" }
      : cta.color === "mantis"
      ? { backgroundColor: "var(--mantis)", color: "var(--midnight)" }
      : { backgroundColor: "var(--nuit)", color: "var(--praxeti)" };

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-xl p-6 flex items-start gap-4" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.28)" }}>
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
          <div>
            <p className="font-semibold" style={{ color: "#EF4444" }}>Failed to load dashboard</p>
            <p className="text-sm mt-1" style={{ color: "rgba(239,68,68,0.70)" }}>{error}</p>
            <button onClick={() => load()} className="mt-3 px-4 py-1.5 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.18)", color: "#EF4444" }}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Pipeline stage bar */}
      <WorkflowStages
        resumeCount={resumeCount}
        jobCount={stats?.total_jobs ?? 0}
        scoredCount={stats?.pipeline?.scored ?? 0}
        appliedCount={stats?.pipeline?.applied ?? 0}
        activeStage={currentStage}
      />

      <div className="flex-1 p-8 space-y-7 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--praxeti)" }}>Welcome back, Lionel</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Here&apos;s where your job search stands today.</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── Dominant CTA card ── */}
        <div
          className="relative overflow-hidden rounded-2xl p-7"
          style={{
            background: cta.color === "spring"
              ? "linear-gradient(135deg, rgba(219,230,76,0.11) 0%, rgba(0,40,80,0.55) 60%)"
              : cta.color === "mantis"
              ? "linear-gradient(135deg, rgba(116,195,101,0.11) 0%, rgba(0,40,80,0.55) 60%)"
              : "linear-gradient(135deg, rgba(30,72,143,0.22) 0%, rgba(0,40,80,0.55) 60%)",
            border: `1px solid ${cta.color === "spring" ? "rgba(219,230,76,0.28)" : cta.color === "mantis" ? "rgba(116,195,101,0.28)" : "rgba(30,72,143,0.45)"}`,
          }}
        >
          {/* Glow */}
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-[0.08] blur-3xl pointer-events-none"
            style={{ backgroundColor: cta.color === "spring" ? "var(--spring)" : cta.color === "mantis" ? "var(--mantis)" : "var(--nuit)", transform: "translate(30%,-30%)" }}
          />
          <div className="relative flex items-start justify-between gap-6">
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Next step</p>
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--praxeti)" }}>{cta.headline}</h2>
              <p className="text-sm leading-relaxed mb-5 max-w-lg" style={{ color: "var(--text-secondary)" }}>{cta.description}</p>
              <Link
                href={cta.buttonHref}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                style={ctaBtnStyle}
              >
                {cta.buttonLabel} <ArrowRight size={15} />
              </Link>
            </div>
            <div
              className="hidden sm:flex w-16 h-16 rounded-2xl items-center justify-center flex-shrink-0"
              style={{ backgroundColor: cta.color === "spring" ? "rgba(219,230,76,0.10)" : cta.color === "mantis" ? "rgba(116,195,101,0.10)" : "rgba(30,72,143,0.20)" }}
            >
              {currentStage === "resume"      && <Upload size={28} style={{ color: "var(--spring)" }} />}
              {currentStage === "discovery"   && <Search size={28} style={{ color: "var(--spring)" }} />}
              {currentStage === "scoring"     && <Target size={28} style={{ color: "var(--nuit-light)" }} />}
              {currentStage === "application" && <Send   size={28} style={{ color: "var(--mantis)" }} />}
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniStat label="Resumes"       value={resumeCount}                  icon={FileText}  color="spring" />
          <MiniStat label="Jobs Found"    value={stats?.total_jobs ?? 0}       icon={Briefcase} color="nuit" />
          <MiniStat label="Scored"        value={stats?.pipeline?.scored ?? 0} icon={Target}    color={stats?.pipeline?.scored ? "mantis" : "nuit"} />
          <MiniStat label="Avg ATS Score" value={avgScore > 0 ? `${Math.round(avgScore)}%` : "—"} icon={BarChart2} color={avgScore >= 80 ? "mantis" : avgScore >= 60 ? "warning" : "nuit"} />
        </div>

        {/* ── Pipeline funnel ── */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-5" style={{ color: "var(--text-secondary)" }}>Pipeline Funnel</h2>
          <div className="flex items-center gap-2">
            {[
              { label: "Found",    count: stats?.pipeline?.found    ?? 0 },
              { label: "Scored",   count: stats?.pipeline?.scored   ?? 0 },
              { label: "Approved", count: stats?.pipeline?.approved ?? 0 },
              { label: "Applied",  count: stats?.pipeline?.applied  ?? 0 },
            ].map(({ label, count }, idx) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className="flex-1 text-center px-3 py-4 rounded-xl border"
                  style={{
                    backgroundColor: count > 0 ? "rgba(30,72,143,0.15)" : "rgba(0,22,45,0.6)",
                    borderColor: count > 0 ? "rgba(30,72,143,0.40)" : "var(--border)",
                  }}
                >
                  <p className="text-2xl font-bold tabular-nums" style={{ color: count > 0 ? "var(--praxeti)" : "var(--text-muted)" }}>{count}</p>
                  <p className="text-xs mt-1 font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
                </div>
                {idx < 3 && <ArrowRight size={16} style={{ color: "rgba(30,72,143,0.45)", flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick links ── */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Quick Access</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Upload Resume",      sub: "Add a new version",     href: "/resumes",      icon: Upload,   color: "spring" as const },
              { label: "Discover Jobs",      sub: "Search & shortlist",    href: "/jobs",         icon: Search,   color: "nuit"   as const },
              { label: "Run Scoring",        sub: "AI ATS analysis",       href: "/scoring",      icon: Target,   color: "nuit"   as const },
              { label: "View Applications",  sub: "Track submissions",     href: "/applications", icon: Send,     color: "mantis" as const },
            ].map(({ label, sub, href, icon: Icon, color }) => {
              const ic = { spring: "var(--spring)", nuit: "var(--nuit-light)", mantis: "var(--mantis)" }[color];
              const bg = { spring: "rgba(219,230,76,0.10)", nuit: "rgba(30,72,143,0.18)", mantis: "rgba(116,195,101,0.10)" }[color];
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 p-4 rounded-xl group"
                  style={{ backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)" }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--border-light)"; el.style.backgroundColor = "var(--midnight-hover)"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--border)"; el.style.backgroundColor = "var(--midnight-card)"; }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                    <Icon size={16} style={{ color: ic }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--praxeti)" }}>{label}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>
                  </div>
                  <ArrowRight size={13} style={{ color: "var(--text-muted)" }} />
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Recent applications ── */}
        {(stats?.recent_applications?.length ?? 0) > 0 && (
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Recent Applications</h2>
              <Link href="/applications" className="text-xs flex items-center gap-1" style={{ color: "var(--nuit-light)" }}>
                View all <ArrowRight size={11} />
              </Link>
            </div>
            <div className="space-y-2">
              {stats!.recent_applications.slice(0, 5).map((app) => {
                const score = app.ats_score ?? app.ats_result?.overall_score;
                return (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg"
                    style={{ backgroundColor: "rgba(0,22,45,0.5)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--praxeti)" }}>{app.job?.title ?? `Application #${app.id}`}</p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{app.job?.company ?? "Unknown"} · {formatDate(app.applied_at || app.created_at)}</p>
                    </div>
                    {score !== undefined && (
                      <span className={clsx("badge border text-xs font-semibold", getScoreBg(score))}>{score}%</span>
                    )}
                    <span
                      className="text-xs font-medium capitalize"
                      style={{ color: app.status === "submitted" ? "var(--mantis)" : app.status === "failed" ? "#EF4444" : "var(--nuit-light)" }}
                    >
                      {app.status.replace(/_/g, " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
