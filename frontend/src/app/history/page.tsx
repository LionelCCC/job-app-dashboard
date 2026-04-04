"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Clock,
  RefreshCw,
  Plus,
  X,
  CheckCircle,
  XCircle,
  Minus,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Play,
  Pause,
  Trash2,
  List,
  Loader2,
  Sun,
  Calendar,
  CalendarDays,
  CalendarRange,
  AlertTriangle,
  Globe,
  Building2,
  StickyNote,
  Zap,
} from "lucide-react";
import {
  fetchTrackedSites,
  addTrackedSite,
  updateTrackedSite,
  deleteTrackedSite,
  checkSiteNow,
  fetchSiteLogs,
  fetchSiteMonitorStats,
  timeUntil,
  timeAgo,
  type TrackedSite,
  type SiteCheckLog,
  type SiteMonitorStats,
} from "@/lib/api";

// ─── Interval Options ──────────────────────────────────────────────────────────

interface IntervalOption {
  hours: number;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
}

const INTERVAL_OPTIONS: IntervalOption[] = [
  {
    hours: 24,
    label: "Every day",
    shortLabel: "Daily",
    icon: Sun,
    description: "24h",
  },
  {
    hours: 48,
    label: "Every 2 days",
    shortLabel: "2 Days",
    icon: CalendarDays,
    description: "48h",
  },
  {
    hours: 72,
    label: "Every 3 days",
    shortLabel: "3 Days",
    icon: CalendarDays,
    description: "72h",
  },
  {
    hours: 168,
    label: "Every week",
    shortLabel: "Weekly",
    icon: Calendar,
    description: "168h",
  },
  {
    hours: 336,
    label: "Every 2 weeks",
    shortLabel: "Biweekly",
    icon: CalendarRange,
    description: "336h",
  },
  {
    hours: 720,
    label: "Every month",
    shortLabel: "Monthly",
    icon: CalendarRange,
    description: "720h",
  },
];

function getIntervalOption(hours: number): IntervalOption {
  return (
    INTERVAL_OPTIONS.find((o) => o.hours === hours) ?? INTERVAL_OPTIONS[3]
  );
}

// ─── Helper: parse domain from URL ────────────────────────────────────────────

function parseDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ─── Progress bar: elapsed fraction through interval ──────────────────────────

function intervalProgress(
  lastCheckedAt: string | undefined,
  intervalHours: number
): number {
  if (!lastCheckedAt) return 0;
  const elapsed = (Date.now() - new Date(lastCheckedAt).getTime()) / 3600000;
  return Math.min(elapsed / intervalHours, 1);
}

// ─── Add Site Modal ────────────────────────────────────────────────────────────

interface AddSiteModalProps {
  onClose: () => void;
  onAdd: (site: TrackedSite) => void;
}

function AddSiteModal({ onClose, onAdd }: AddSiteModalProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [intervalHours, setIntervalHours] = useState(168);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUrlBlur = () => {
    if (url && !name) {
      setName(parseDomain(url));
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text.trim());
      if (!name) setName(parseDomain(text.trim()));
    } catch {
      // clipboard unavailable
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const site = await addTrackedSite({
        url: url.trim(),
        name: name.trim() || parseDomain(url),
        company: company.trim(),
        notes: notes.trim() || undefined,
        interval_hours: intervalHours,
      });
      onAdd(site);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add site");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <h2 className="text-base font-semibold text-slate-100">
              Add Site to Monitor
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              URL <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://company.com/careers"
                required
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
              >
                <Clipboard size={13} />
                Paste
              </button>
            </div>
          </div>

          {/* Site Name + Company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Site Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-filled from URL"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this site..."
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 resize-none"
            />
          </div>

          {/* Check Interval */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Check Interval
            </label>
            <div className="grid grid-cols-3 gap-2">
              {INTERVAL_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = intervalHours === opt.hours;
                return (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() => setIntervalHours(opt.hours)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all duration-150 ${
                      selected
                        ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                    }`}
                  >
                    <Icon
                      size={16}
                      className={selected ? "text-indigo-400" : "text-slate-500"}
                    />
                    <span className="text-xs font-medium leading-tight">
                      {opt.label}
                    </span>
                    <span
                      className={`text-[10px] ${
                        selected ? "text-indigo-400/70" : "text-slate-600"
                      }`}
                    >
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Zap size={14} />
              )}
              Start Tracking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Log Panel ─────────────────────────────────────────────────────────────────

interface LogPanelProps {
  siteId: number;
  initialLogs: SiteCheckLog[];
}

function LogPanel({ siteId, initialLogs }: LogPanelProps) {
  const [logs, setLogs] = useState<SiteCheckLog[]>(initialLogs);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialLogs.length >= 10);

  const loadMore = async () => {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const more = await fetchSiteLogs(siteId, nextPage);
      setLogs((prev) => [...prev, ...more]);
      setPage(nextPage);
      if (more.length < 10) setHasMore(false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status: SiteCheckLog["status"]) => {
    if (status === "success")
      return <CheckCircle size={14} className="text-green-400" />;
    if (status === "error")
      return <XCircle size={14} className="text-red-400" />;
    return <Minus size={14} className="text-slate-500" />;
  };

  const statusLabel = (status: SiteCheckLog["status"]) => {
    if (status === "success") return "Success";
    if (status === "error") return "Error";
    return "No change";
  };

  if (logs.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No checks run yet</p>
        <p className="text-xs text-slate-600 mt-0.5">
          Click &ldquo;Check Now&rdquo; to start
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left px-3 py-2 text-slate-500 font-medium">
              Date / Time
            </th>
            <th className="text-left px-3 py-2 text-slate-500 font-medium">
              Status
            </th>
            <th className="text-right px-3 py-2 text-slate-500 font-medium">
              Jobs Found
            </th>
            <th className="text-right px-3 py-2 text-slate-500 font-medium">
              New Jobs
            </th>
            <th className="text-left px-3 py-2 text-slate-500 font-medium">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors"
            >
              <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                {timeAgo(log.checked_at)}
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5">
                  {statusIcon(log.status)}
                  <span
                    className={
                      log.status === "success"
                        ? "text-green-400"
                        : log.status === "error"
                          ? "text-red-400"
                          : "text-slate-500"
                    }
                  >
                    {statusLabel(log.status)}
                  </span>
                </span>
              </td>
              <td className="px-3 py-2 text-right text-slate-300">
                {log.jobs_found}
              </td>
              <td className="px-3 py-2 text-right">
                <span
                  className={
                    log.new_jobs > 0 ? "text-green-400 font-medium" : "text-slate-500"
                  }
                >
                  {log.new_jobs > 0 ? `+${log.new_jobs}` : "—"}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">
                {log.error_message ?? log.job_titles_found?.slice(0, 2).join(", ") ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <div className="px-3 py-2 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Interval Dropdown ─────────────────────────────────────────────────────────

interface IntervalDropdownProps {
  currentHours: number;
  onSelect: (hours: number) => void;
  onClose: () => void;
}

function IntervalDropdown({
  currentHours,
  onSelect,
  onClose,
}: IntervalDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-1 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 min-w-[160px]"
    >
      {INTERVAL_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.hours}
            onClick={() => {
              onSelect(opt.hours);
              onClose();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-slate-700 transition-colors ${
              currentHours === opt.hours
                ? "text-indigo-300"
                : "text-slate-300"
            }`}
          >
            <Icon
              size={13}
              className={
                currentHours === opt.hours ? "text-indigo-400" : "text-slate-500"
              }
            />
            <span className="flex-1 text-left">{opt.label}</span>
            {currentHours === opt.hours && (
              <CheckCircle size={11} className="text-indigo-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Site Card ─────────────────────────────────────────────────────────────────

interface SiteCardProps {
  site: TrackedSite;
  onUpdated: (site: TrackedSite) => void;
  onDeleted: (id: number) => void;
}

function SiteCard({ site, onUpdated, onDeleted }: SiteCardProps) {
  const [checking, setChecking] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<SiteCheckLog[]>(site.recent_logs ?? []);
  const [intervalDropOpen, setIntervalDropOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deletingId, setDeletingId] = useState(false);

  const intervalOpt = getIntervalOption(site.interval_hours);
  const IntervalIcon = intervalOpt.icon;
  const progress = intervalProgress(site.last_checked_at, site.interval_hours);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      await checkSiteNow(site.id);
      // Re-fetch logs after check
      const fresh = await fetchSiteLogs(site.id, 1);
      setLogs(fresh);
      setLogsOpen(true);
    } catch {
      // silently show error in logs
    } finally {
      setChecking(false);
    }
  };

  const handleTogglePause = async () => {
    setToggling(true);
    try {
      const updated = await updateTrackedSite(site.id, {
        is_active: !site.is_active,
      });
      onUpdated(updated);
    } catch {
      // ignore
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeletingId(true);
    try {
      await deleteTrackedSite(site.id);
      onDeleted(site.id);
    } catch {
      // ignore
    } finally {
      setDeletingId(false);
      setConfirmDelete(false);
    }
  };

  const handleIntervalChange = async (hours: number) => {
    try {
      const updated = await updateTrackedSite(site.id, {
        interval_hours: hours,
      });
      onUpdated(updated);
    } catch {
      // ignore
    }
  };

  const handleLogsToggle = async () => {
    if (!logsOpen && logs.length === 0) {
      try {
        const fresh = await fetchSiteLogs(site.id, 1);
        setLogs(fresh);
      } catch {
        // ignore
      }
    }
    setLogsOpen((prev) => !prev);
  };

  return (
    <div className="card hover:border-slate-600 transition-all duration-200">
      {/* Main row */}
      <div className="flex items-start gap-4">
        {/* Status dot + favicon placeholder */}
        <div className="flex flex-col items-center gap-2 pt-0.5 flex-shrink-0">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              site.is_active ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-slate-600"
            }`}
          />
          <div className="w-7 h-7 rounded-md bg-slate-700 border border-slate-600 flex items-center justify-center">
            <Globe size={13} className="text-slate-400" />
          </div>
        </div>

        {/* Site info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            {/* Left: name + url + notes */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-slate-100 truncate">
                  {site.name}
                </h3>
                {site.company && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Building2 size={11} />
                    {site.company}
                  </span>
                )}
              </div>
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 truncate block max-w-xs mt-0.5 transition-colors"
              >
                {site.url}
              </a>
              {site.notes && (
                <p className="flex items-start gap-1 text-xs text-slate-500 mt-1">
                  <StickyNote size={11} className="flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{site.notes}</span>
                </p>
              )}
            </div>

            {/* Right: status + stats */}
            <div className="flex-shrink-0 text-right space-y-1">
              {site.next_check_at && (
                <p className="text-xs text-slate-400">
                  <span
                    className={
                      timeUntil(site.next_check_at) === "Due now" ||
                      timeUntil(site.next_check_at).startsWith("Overdue")
                        ? "text-yellow-400 font-medium"
                        : ""
                    }
                  >
                    {timeUntil(site.next_check_at)}
                  </span>
                </p>
              )}
              {site.last_checked_at && (
                <p className="text-xs text-slate-600">
                  Last: {timeAgo(site.last_checked_at)}
                </p>
              )}
              <div>
                {site.new_jobs_last_check > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-400/10 border border-green-400/30 text-green-400">
                    <CheckCircle size={10} />+{site.new_jobs_last_check} new jobs
                  </span>
                ) : site.last_checked_at ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-slate-500 bg-slate-800 border border-slate-700">
                    No new jobs
                  </span>
                ) : null}
              </div>
              {site.jobs_found_total > 0 && (
                <p className="text-[11px] text-slate-600">
                  {site.jobs_found_total} total found
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {site.is_active && site.last_checked_at && (
            <div className="mt-3 mb-1">
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${progress * 100}%`,
                    background:
                      "linear-gradient(90deg, #6366f1, #334155)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Interval badge + dropdown */}
            <div className="relative">
              <button
                onClick={() => setIntervalDropOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20 transition-colors"
              >
                <IntervalIcon size={11} />
                {intervalOpt.shortLabel}
                <ChevronDown size={10} />
              </button>
              {intervalDropOpen && (
                <IntervalDropdown
                  currentHours={site.interval_hours}
                  onSelect={handleIntervalChange}
                  onClose={() => setIntervalDropOpen(false)}
                />
              )}
            </div>

            {/* Check Now */}
            <button
              onClick={handleCheckNow}
              disabled={checking}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 disabled:opacity-50 transition-colors"
            >
              {checking ? (
                <Loader2 size={11} className="animate-spin text-indigo-400" />
              ) : (
                <RefreshCw size={11} />
              )}
              {checking ? "Checking…" : "Check Now"}
            </button>

            {/* Pause / Resume */}
            <button
              onClick={handleTogglePause}
              disabled={toggling}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                site.is_active
                  ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-yellow-300 hover:border-yellow-500/30"
                  : "bg-green-400/10 border-green-500/30 text-green-400 hover:bg-green-400/20"
              }`}
            >
              {toggling ? (
                <Loader2 size={11} className="animate-spin" />
              ) : site.is_active ? (
                <Pause size={11} />
              ) : (
                <Play size={11} />
              )}
              {site.is_active ? "Pause" : "Resume"}
            </button>

            {/* View Logs */}
            <button
              onClick={handleLogsToggle}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
            >
              <List size={11} />
              View Logs
              {logsOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={deletingId}
              onBlur={() => setConfirmDelete(false)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ml-auto ${
                confirmDelete
                  ? "bg-red-500/20 border-red-500/40 text-red-300"
                  : "bg-slate-800 border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-500/30"
              }`}
            >
              {deletingId ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Trash2 size={11} />
              )}
              {confirmDelete ? "Confirm?" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      {/* Log Panel */}
      {logsOpen && (
        <div className="mt-4 pt-4 border-t border-slate-700/60">
          <LogPanel siteId={site.id} initialLogs={logs} />
        </div>
      )}
    </div>
  );
}

// ─── Stats Chip ────────────────────────────────────────────────────────────────

function StatsChip({
  label,
  value,
  color = "text-slate-300",
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
      <span className={`font-semibold ${color}`}>{value}</span>
      <span className="text-slate-500">{label}</span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [stats, setStats] = useState<SiteMonitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sitesData, statsData] = await Promise.allSettled([
        fetchTrackedSites(),
        fetchSiteMonitorStats(),
      ]);
      if (sitesData.status === "fulfilled") setSites(sitesData.value);
      if (statsData.status === "fulfilled") setStats(statsData.value);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const handleSiteAdded = (site: TrackedSite) => {
    setSites((prev) => [site, ...prev]);
    setStats((prev) =>
      prev
        ? {
            ...prev,
            total_sites: prev.total_sites + 1,
            active_sites: site.is_active ? prev.active_sites + 1 : prev.active_sites,
          }
        : prev
    );
  };

  const handleSiteUpdated = (updated: TrackedSite) => {
    setSites((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  const handleSiteDeleted = (id: number) => {
    setSites((prev) => prev.filter((s) => s.id !== id));
    setStats((prev) =>
      prev ? { ...prev, total_sites: Math.max(0, prev.total_sites - 1) } : prev
    );
  };

  const dueSites = sites.filter(
    (s) =>
      s.is_active &&
      s.next_check_at &&
      (timeUntil(s.next_check_at) === "Due now" ||
        timeUntil(s.next_check_at).startsWith("Overdue"))
  );

  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      await Promise.allSettled(dueSites.map((s) => checkSiteNow(s.id)));
      await load();
    } finally {
      setCheckingAll(false);
    }
  };

  const activeSites = sites.filter((s) => s.is_active);
  const totalJobsFound = sites.reduce((sum, s) => sum + s.jobs_found_total, 0);

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-indigo-400" size={18} />
              </div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
                Site Monitor
              </h1>
            </div>
            <p className="text-sm text-slate-500 ml-[52px]">
              Automatically track job boards for new listings
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Stats chips */}
            <StatsChip label="sites tracked" value={sites.length} />
            <StatsChip
              label="active"
              value={activeSites.length}
              color="text-green-400"
            />
            {dueSites.length > 0 && (
              <StatsChip
                label="due now"
                value={dueSites.length}
                color="text-yellow-400"
              />
            )}
            <StatsChip
              label="total jobs found"
              value={totalJobsFound}
              color="text-indigo-400"
            />
          </div>
        </div>

        {/* Due Now Banner */}
        {dueSites.length > 0 && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-yellow-400/10 border border-yellow-400/30 fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-200">
                <span className="font-semibold">{dueSites.length}</span>{" "}
                {dueSites.length === 1 ? "site is" : "sites are"} due for a check
              </p>
            </div>
            <button
              onClick={handleCheckAll}
              disabled={checkingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-200 bg-yellow-400/10 border border-yellow-400/30 rounded-lg hover:bg-yellow-400/20 transition-colors disabled:opacity-50"
            >
              {checkingAll ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Zap size={12} />
              )}
              Check All Now
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-400/10 border border-red-400/20 text-sm text-red-300">
            <XCircle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading shimmer */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl shimmer border border-slate-700"
              />
            ))}
          </div>
        )}

        {/* Sites list */}
        {!loading && sites.length > 0 && (
          <div className="space-y-3">
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                onUpdated={handleSiteUpdated}
                onDeleted={handleSiteDeleted}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && sites.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center fade-in">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
              <Clock size={28} className="text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300 mb-1">
              No sites tracked yet
            </h3>
            <p className="text-sm text-slate-500 max-w-xs mb-6">
              Add job board URLs to automatically monitor them for new listings
              on your chosen schedule.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
            >
              <Plus size={15} />
              Add your first site
            </button>
          </div>
        )}

        {/* Floating Add button (visible when sites exist) */}
        {sites.length > 0 && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-300 bg-indigo-600/10 border border-indigo-500/30 rounded-lg hover:bg-indigo-600/20 transition-colors"
            >
              <Plus size={15} />
              Add Site
            </button>
          </div>
        )}
      </div>

      {/* Add Site Modal */}
      {modalOpen && (
        <AddSiteModal
          onClose={() => setModalOpen(false)}
          onAdd={handleSiteAdded}
        />
      )}
    </div>
  );
}
