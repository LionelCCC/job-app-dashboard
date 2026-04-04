"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Briefcase,
  FileText,
  Send,
  TrendingUp,
  ArrowRight,
  Search,
  Upload,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import clsx from "clsx";
import StatsCard from "@/components/StatsCard";
import {
  fetchStats,
  Stats,
  Application,
  JobType,
  getScoreBg,
  formatDate,
} from "@/lib/api";

const JOB_TYPE_COLORS: Record<string, string> = {
  SWE: "#6366f1",
  DE: "#3b82f6",
  DA: "#10b981",
  DS: "#f59e0b",
  MLE: "#ec4899",
  AIE: "#a855f7",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  to_apply: {
    label: "To Apply",
    icon: Clock,
    color: "text-blue-400",
  },
  reviewing: {
    label: "Reviewing",
    icon: Search,
    color: "text-yellow-400",
  },
  applying: {
    label: "Applying",
    icon: Send,
    color: "text-indigo-400",
  },
  submitted: {
    label: "Submitted",
    icon: CheckCircle,
    color: "text-green-400",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    color: "text-red-400",
  },
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-800 rounded-xl shimmer" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-64 bg-slate-800 rounded-xl shimmer" />
        <div className="h-64 bg-slate-800 rounded-xl shimmer" />
      </div>
    </div>
  );
}

function PipelineStep({
  label,
  count,
  active,
}: {
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex-1 text-center px-4 py-4 rounded-xl border transition-all",
        active
          ? "bg-indigo-600/15 border-indigo-500/40"
          : "bg-slate-800/60 border-slate-700/50"
      )}
    >
      <p
        className={clsx(
          "text-2xl font-bold tabular-nums",
          active ? "text-indigo-400" : "text-slate-300"
        )}
      >
        {count}
      </p>
      <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Build recharts data
  const atsDistData = stats?.ats_distribution
    ? Object.entries(stats.ats_distribution).map(([range, count]) => ({
        range,
        count,
      }))
    : [];

  const jobTypeData = stats?.job_type_breakdown
    ? Object.entries(stats.job_type_breakdown)
        .filter(([, v]) => v > 0)
        .map(([type, count]) => ({
          name: type as JobType,
          value: count,
          color: JOB_TYPE_COLORS[type] || "#6366f1",
        }))
    : [];

  const avgScore = stats?.avg_ats_score ?? 0;

  if (loading) return <div className="p-8"><LoadingSkeleton /></div>;

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-red-400">Failed to load dashboard</p>
            <p className="text-sm text-red-400/70 mt-1">{error}</p>
            <button
              onClick={() => loadStats()}
              className="mt-3 px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Your job application pipeline at a glance
          </p>
        </div>
        <button
          onClick={() => loadStats(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Jobs Found"
          value={stats?.total_jobs ?? 0}
          icon={Briefcase}
          accent="indigo"
          subtitle="Total discovered"
        />
        <StatsCard
          title="Resumes"
          value={stats?.total_resumes ?? 0}
          icon={FileText}
          accent="blue"
          subtitle="Uploaded & parsed"
        />
        <StatsCard
          title="Applications Sent"
          value={stats?.total_applications ?? 0}
          icon={Send}
          accent="green"
          subtitle="Across all pipelines"
        />
        <StatsCard
          title="Avg ATS Score"
          value={`${Math.round(avgScore)}%`}
          icon={TrendingUp}
          accent={avgScore >= 80 ? "green" : avgScore >= 60 ? "yellow" : "indigo"}
          subtitle="Overall average"
        />
      </div>

      {/* Pipeline visualization */}
      <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-5">
          Application Pipeline
        </h2>
        <div className="flex items-center gap-2">
          <PipelineStep
            label="Found"
            count={stats?.pipeline?.found ?? 0}
          />
          <ArrowRight size={16} className="text-slate-600 flex-shrink-0" />
          <PipelineStep
            label="Scored"
            count={stats?.pipeline?.scored ?? 0}
          />
          <ArrowRight size={16} className="text-slate-600 flex-shrink-0" />
          <PipelineStep
            label="Approved"
            count={stats?.pipeline?.approved ?? 0}
            active
          />
          <ArrowRight size={16} className="text-slate-600 flex-shrink-0" />
          <PipelineStep
            label="Applied"
            count={stats?.pipeline?.applied ?? 0}
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ATS score distribution */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700/60 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-5">
            ATS Score Distribution
          </h2>
          {atsDistData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={atsDistData}
                margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
              >
                <XAxis
                  dataKey="range"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#f1f5f9",
                    fontSize: 12,
                  }}
                  cursor={{ fill: "rgba(99,102,241,0.1)" }}
                />
                <Bar
                  dataKey="count"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
              No score data yet
            </div>
          )}
        </div>

        {/* Job type breakdown */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-5">
            Job Type Breakdown
          </h2>
          {jobTypeData.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={jobTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {jobTypeData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#f1f5f9",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {jobTypeData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-slate-400 truncate">
                      {d.name}
                    </span>
                    <span className="text-slate-500 ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Recent activity + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700/60 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-300">
              Recent Applications
            </h2>
            <Link
              href="/applications"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {stats?.recent_applications?.length ? (
            <div className="space-y-3">
              {stats.recent_applications.slice(0, 8).map((app: Application) => {
                const statusCfg =
                  STATUS_CONFIG[app.status] || STATUS_CONFIG.to_apply;
                const Icon = statusCfg.icon;
                const score =
                  app.ats_score ?? app.ats_result?.overall_score;
                return (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 py-2 border-b border-slate-700/40 last:border-0"
                  >
                    <Icon
                      size={14}
                      className={clsx("flex-shrink-0", statusCfg.color)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate font-medium">
                        {app.job?.title ?? `Application #${app.id}`}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {app.job?.company ?? "Unknown"} •{" "}
                        {formatDate(app.updated_at || app.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {score !== undefined && (
                        <span
                          className={clsx(
                            "badge border text-xs font-semibold",
                            getScoreBg(score)
                          )}
                        >
                          {score}%
                        </span>
                      )}
                      <span
                        className={clsx(
                          "text-xs font-medium",
                          statusCfg.color
                        )}
                      >
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-slate-600 gap-2">
              <Clock size={32} className="text-slate-700" />
              <p className="text-sm">No applications yet</p>
              <Link
                href="/jobs"
                className="text-xs text-indigo-400 hover:text-indigo-300 mt-1"
              >
                Discover jobs to get started
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-5">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link
              href="/jobs"
              className="flex items-center gap-3 p-4 rounded-xl bg-indigo-600/10 border border-indigo-500/25 hover:bg-indigo-600/20 hover:border-indigo-500/40 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600/30 transition-colors">
                <Search size={16} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">
                  Search Jobs
                </p>
                <p className="text-xs text-slate-500 truncate">
                  Find new opportunities
                </p>
              </div>
              <ArrowRight
                size={14}
                className="text-slate-600 group-hover:text-indigo-400 transition-colors"
              />
            </Link>

            <Link
              href="/resumes"
              className="flex items-center gap-3 p-4 rounded-xl bg-slate-700/30 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-600 transition-colors">
                <Upload size={16} className="text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">
                  Upload Resume
                </p>
                <p className="text-xs text-slate-500 truncate">
                  Add a new resume version
                </p>
              </div>
              <ArrowRight
                size={14}
                className="text-slate-600 group-hover:text-slate-400 transition-colors"
              />
            </Link>

            <Link
              href="/applications"
              className="flex items-center gap-3 p-4 rounded-xl bg-slate-700/30 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-600 transition-colors">
                <TrendingUp size={16} className="text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">
                  View Pipeline
                </p>
                <p className="text-xs text-slate-500 truncate">
                  Manage applications
                </p>
              </div>
              <ArrowRight
                size={14}
                className="text-slate-600 group-hover:text-slate-400 transition-colors"
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
