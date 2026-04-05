"use client";

/**
 * Sources page — unified job source management.
 * Shows all tracked career sites with capability tags, monitoring status,
 * and the ability to run immediate checks or toggle scheduling.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Plus, X, Globe, Trash2, Play, Pause, RefreshCw,
  CheckCircle, XCircle, Minus, Clipboard, AlertTriangle,
  Loader2, Radio, Search, Link2, Clock, Calendar, Zap,
  ChevronDown, ChevronUp, Sun, CalendarDays, CalendarRange,
} from "lucide-react";
import {
  fetchTrackedSites, addTrackedSite, updateTrackedSite, deleteTrackedSite,
  checkSiteNow, fetchSiteMonitorStats,
  timeUntil, timeAgo,
  type TrackedSite, type SiteMonitorStats,
} from "@/lib/api";

// ─── Interval options ─────────────────────────────────────────────────────────
const INTERVALS = [
  { hours: 24,  label: "Daily",    icon: Sun          },
  { hours: 48,  label: "2 Days",   icon: CalendarDays },
  { hours: 72,  label: "3 Days",   icon: CalendarDays },
  { hours: 168, label: "Weekly",   icon: Calendar     },
  { hours: 336, label: "Biweekly", icon: CalendarRange},
  { hours: 720, label: "Monthly",  icon: CalendarRange},
];

function intervalLabel(hours: number) {
  return INTERVALS.find((i) => i.hours === hours)?.label ?? `${hours}h`;
}

// ─── Capability inference from URL ────────────────────────────────────────────
type Capability = "keyword-search" | "direct-url" | "monitored";

function inferCapabilities(url: string): Capability[] {
  const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return url.toLowerCase(); } })();
  const caps: Capability[] = ["monitored"];
  if (host.includes("linkedin.com") || host.includes("indeed.com")) {
    caps.unshift("keyword-search");
  } else {
    caps.unshift("direct-url");
  }
  return caps;
}

function CapabilityBadge({ cap }: { cap: Capability }) {
  const cfg = {
    "keyword-search": { label: "Keyword Search",  icon: Search, color: "rgba(219,230,76,0.15)",  text: "var(--spring)",     border: "rgba(219,230,76,0.30)"   },
    "direct-url":     { label: "Direct URL Only", icon: Link2,  color: "rgba(30, 72,143,0.18)",  text: "var(--nuit-light)", border: "rgba(30,72,143,0.35)"    },
    "monitored":      { label: "Scheduled Check", icon: Radio,  color: "rgba(116,195,101,0.13)", text: "var(--mantis)",     border: "rgba(116,195,101,0.30)"  },
  }[cap];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ backgroundColor: cfg.color, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      <Icon size={9} /> {cfg.label}
    </span>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>;
  if (status === "success")   return <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--mantis)" }}><CheckCircle size={12} />OK</span>;
  if (status === "no_change") return <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}><Minus size={12} />No change</span>;
  return <span className="inline-flex items-center gap-1 text-xs" style={{ color: "#EF4444" }}><XCircle size={12} />Error</span>;
}

// ─── Parse domain ─────────────────────────────────────────────────────────────
function parseDomain(url: string) {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

// ─── Add Site modal ───────────────────────────────────────────────────────────
function AddSourceModal({ onClose, onAdd }: { onClose: () => void; onAdd: (s: TrackedSite) => void }) {
  const [url, setUrl]           = useState("");
  const [name, setName]         = useState("");
  const [company, setCompany]   = useState("");
  const [notes, setNotes]       = useState("");
  const [hours, setHours]       = useState(168);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  const pasteURL = async () => {
    try { const t = await navigator.clipboard.readText(); setUrl(t.trim()); if (!name) setName(parseDomain(t.trim())); }
    catch { /* noop */ }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const s = await addTrackedSite({ url: url.trim(), name: name.trim() || parseDomain(url), company: company.trim(), notes: notes.trim() || undefined, interval_hours: hours });
      onAdd(s); onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    } finally { setBusy(false); }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--midnight)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    color: "var(--praxeti)",
    width: "100%",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl fade-in" style={{ backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(219,230,76,0.12)", border: "1px solid rgba(219,230,76,0.25)" }}>
              <Plus size={14} style={{ color: "var(--spring)" }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--praxeti)" }}>Add Source</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {/* URL */}
          <div>
            <label style={labelStyle}>URL <span style={{ color: "#EF4444" }}>*</span></label>
            <div className="flex gap-2">
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => !name && url && setName(parseDomain(url))} placeholder="https://company.com/careers" required style={{ ...inputStyle, flex: 1 }} />
              <button type="button" onClick={pasteURL} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "var(--midnight)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <Clipboard size={12} /> Paste
              </button>
            </div>
            {url && (
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {inferCapabilities(url).map((c) => <CapabilityBadge key={c} cap={c} />)}
              </div>
            )}
          </div>

          {/* Name + Company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Display Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stripe Careers" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Stripe" style={inputStyle} />
            </div>
          </div>

          {/* Interval */}
          <div>
            <label style={labelStyle}>Check Interval</label>
            <div className="flex flex-wrap gap-2">
              {INTERVALS.map(({ hours: h, label }) => (
                <button
                  key={h} type="button" onClick={() => setHours(h)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    backgroundColor: hours === h ? "rgba(219,230,76,0.14)" : "var(--midnight)",
                    color: hours === h ? "var(--spring)" : "var(--text-secondary)",
                    border: `1px solid ${hours === h ? "rgba(219,230,76,0.30)" : "var(--border)"}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this source…" rows={2} style={{ ...inputStyle, resize: "none" }} />
          </div>

          {err && (
            <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <AlertTriangle size={14} style={{ color: "#EF4444" }} className="flex-shrink-0 mt-0.5" />
              <p className="text-xs" style={{ color: "#EF4444" }}>{err}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--midnight)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button type="submit" disabled={busy || !url.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2" style={{ backgroundColor: "var(--spring)", color: "var(--midnight)" }}>
              {busy && <Loader2 size={13} className="animate-spin" />}
              {busy ? "Checking URL…" : "Add Source"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Site row ─────────────────────────────────────────────────────────────────
function SourceRow({ site, onUpdate, onDelete }: { site: TrackedSite; onUpdate: (s: TrackedSite) => void; onDelete: (id: number) => void }) {
  const [expanded, setExpanded]   = useState(false);
  const [checking, setChecking]   = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [toggling, setToggling]   = useState(false);
  const [checkResult, setCheckResult] = useState<{ status: string; new_jobs: number; jobs_found: number; job_titles_found: string[]; error_message?: string } | null>(null);

  const caps = inferCapabilities(site.url);
  const lastLog = site.recent_logs?.[0];

  const runCheck = async () => {
    setChecking(true); setCheckResult(null);
    try {
      const r = await checkSiteNow(site.id);
      setCheckResult(r);
      // Refresh site data after check
      const updated = await import("@/lib/api").then((m) => m.fetchTrackedSites());
      const found = updated.find((s) => s.id === site.id);
      if (found) onUpdate(found);
    } catch (ex) {
      setCheckResult({ status: "error", new_jobs: 0, jobs_found: 0, job_titles_found: [], error_message: ex instanceof Error ? ex.message : "Unknown error" });
    } finally { setChecking(false); }
  };

  const toggleActive = async () => {
    setToggling(true);
    try {
      const updated = await updateTrackedSite(site.id, { is_active: !site.is_active });
      onUpdate(updated);
    } finally { setToggling(false); }
  };

  const doDelete = async () => {
    if (!confirm(`Delete "${site.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try { await deleteTrackedSite(site.id); onDelete(site.id); }
    finally { setDeleting(false); }
  };

  const rowStyle: React.CSSProperties = {
    backgroundColor: "var(--midnight-card)",
    border: "1px solid var(--border)",
    borderRadius: "0.875rem",
    overflow: "hidden",
    transition: "border-color 0.15s ease",
  };

  return (
    <div style={rowStyle}>
      {/* Main row */}
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Globe icon */}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: site.is_active ? "rgba(116,195,101,0.12)" : "rgba(30,72,143,0.15)" }}>
          <Globe size={16} style={{ color: site.is_active ? "var(--mantis)" : "var(--text-muted)" }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: "var(--praxeti)" }}>{site.name}</span>
            {site.company && <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {site.company}</span>}
            {!site.is_active && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(30,72,143,0.15)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Paused</span>
            )}
          </div>

          {/* Capabilities */}
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {caps.map((c) => <CapabilityBadge key={c} cap={c} />)}
          </div>

          {/* URL */}
          <a href={site.url} target="_blank" rel="noreferrer" className="text-xs mt-1.5 block truncate max-w-xs" style={{ color: "var(--nuit-light)" }}>{site.url}</a>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 flex-shrink-0 text-right">
          <div>
            <p className="text-lg font-bold tabular-nums" style={{ color: "var(--praxeti)" }}>{site.jobs_found_total}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>total jobs</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums" style={{ color: site.new_jobs_last_check > 0 ? "var(--spring)" : "var(--text-muted)" }}>+{site.new_jobs_last_check}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>last check</p>
          </div>
          <div>
            <StatusBadge status={lastLog?.status} />
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {site.last_checked_at ? timeAgo(site.last_checked_at) : "Never"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {/* Check now */}
          <button
            onClick={runCheck}
            disabled={checking}
            title="Check now"
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
            style={{ backgroundColor: "rgba(219,230,76,0.10)", border: "1px solid rgba(219,230,76,0.22)", color: "var(--spring)" }}
          >
            {checking ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          </button>

          {/* Pause/Resume */}
          <button
            onClick={toggleActive}
            disabled={toggling}
            title={site.is_active ? "Pause monitoring" : "Resume monitoring"}
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
            style={{ backgroundColor: "rgba(30,72,143,0.15)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            {toggling ? <Loader2 size={14} className="animate-spin" /> : site.is_active ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Expand */}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "rgba(30,72,143,0.12)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Delete */}
          <button
            onClick={doDelete}
            disabled={deleting}
            title="Delete"
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
            style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#EF4444" }}
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {/* Check result banner */}
      {checkResult && (
        <div
          className="mx-5 mb-3 px-4 py-2.5 rounded-lg text-sm flex items-start gap-3"
          style={{
            backgroundColor: checkResult.status === "error" ? "rgba(239,68,68,0.08)" : checkResult.new_jobs > 0 ? "rgba(219,230,76,0.08)" : "rgba(30,72,143,0.12)",
            border: `1px solid ${checkResult.status === "error" ? "rgba(239,68,68,0.25)" : checkResult.new_jobs > 0 ? "rgba(219,230,76,0.25)" : "rgba(30,72,143,0.25)"}`,
          }}
        >
          {checkResult.status === "error"
            ? <XCircle size={15} style={{ color: "#EF4444" }} className="flex-shrink-0 mt-0.5" />
            : checkResult.new_jobs > 0
            ? <CheckCircle size={15} style={{ color: "var(--spring)" }} className="flex-shrink-0 mt-0.5" />
            : <Minus size={15} style={{ color: "var(--text-muted)" }} className="flex-shrink-0 mt-0.5" />}
          <div>
            {checkResult.status === "error"
              ? <p style={{ color: "#EF4444" }}>{checkResult.error_message ?? "Check failed"}</p>
              : checkResult.new_jobs > 0
              ? <p style={{ color: "var(--spring)" }}>{checkResult.new_jobs} new job{checkResult.new_jobs !== 1 ? "s" : ""} found ({checkResult.jobs_found} total links)</p>
              : <p style={{ color: "var(--text-muted)" }}>No new jobs found ({checkResult.jobs_found} total links checked)</p>}
            {checkResult.job_titles_found.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {checkResult.job_titles_found.slice(0, 5).map((t, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>· {t}</li>
                ))}
                {checkResult.job_titles_found.length > 5 && (
                  <li className="text-xs" style={{ color: "var(--text-muted)" }}>+ {checkResult.job_titles_found.length - 5} more</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Expanded: recent logs + schedule */}
      {expanded && (
        <div className="px-5 pb-4 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3 pt-3">
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Recent Checks</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Next: {site.next_check_at ? timeUntil(site.next_check_at) : "Not scheduled"} · Every {intervalLabel(site.interval_hours)}
            </p>
          </div>
          {site.recent_logs && site.recent_logs.length > 0 ? (
            <div className="space-y-1.5">
              {site.recent_logs.map((log, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "rgba(0,22,45,0.5)", border: "1px solid var(--border)" }}>
                  <StatusBadge status={log.status} />
                  <span style={{ color: "var(--text-muted)" }}>{timeAgo(log.checked_at)}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{log.jobs_found} links · +{log.new_jobs} new</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No checks yet.</p>
          )}
          {site.notes && (
            <p className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)", backgroundColor: "rgba(30,72,143,0.10)", border: "1px solid var(--border)" }}>
              📝 {site.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SourcesPage() {
  const [sites, setSites]   = useState<TrackedSite[]>([]);
  const [monStats, setMonStats] = useState<SiteMonitorStats | null>(null);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);
  const [showAdd, setShowAdd]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [s, ms] = await Promise.all([fetchTrackedSites(), fetchSiteMonitorStats()]);
      setSites(s);
      setMonStats(ms);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Failed to load sources");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateSite  = (updated: TrackedSite) => setSites((prev) => prev.map((s) => s.id === updated.id ? updated : s));
  const removeSite  = (id: number) => setSites((prev) => prev.filter((s) => s.id !== id));
  const addSite     = (s: TrackedSite) => setSites((prev) => [...prev, s]);

  const cardStyle: React.CSSProperties = { backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)", borderRadius: "0.875rem", padding: "1.25rem" };

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--praxeti)" }}>Sources</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Track career pages and monitor them automatically for new job listings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--midnight-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: "var(--spring)", color: "var(--midnight)" }}
          >
            <Plus size={15} /> Add Source
          </button>
        </div>
      </div>

      {/* Monitoring stats */}
      {monStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Tracked Sites", value: monStats.total_sites,   color: "nuit"   },
            { label: "Active",        value: monStats.active_sites,  color: "mantis" },
            { label: "Checks Run",    value: monStats.total_checks_run, color: "nuit" },
            { label: "Jobs Found",    value: monStats.total_jobs_found, color: "spring" },
          ].map(({ label, value, color }) => {
            const c = { nuit: "var(--nuit-light)", mantis: "var(--mantis)", spring: "var(--spring)" }[color];
            const bg = { nuit: "rgba(30,72,143,0.18)", mantis: "rgba(116,195,101,0.10)", spring: "rgba(219,230,76,0.10)" }[color];
            return (
              <div key={label} style={cardStyle} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
                  <Radio size={15} style={{ color: c }} />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: "var(--praxeti)" }}>{value}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Capability legend */}
      <div style={{ ...cardStyle, padding: "1rem 1.25rem" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Source Capabilities</p>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <CapabilityBadge cap="keyword-search" />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Can search by keyword (LinkedIn, Indeed)</span>
          </div>
          <div className="flex items-center gap-2">
            <CapabilityBadge cap="direct-url" />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Company career page — add by URL</span>
          </div>
          <div className="flex items-center gap-2">
            <CapabilityBadge cap="monitored" />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Checked automatically on schedule</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertTriangle size={16} style={{ color: "#EF4444" }} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium" style={{ color: "#EF4444" }}>Failed to load sources</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(239,68,68,0.70)" }}>{error}</p>
          </div>
        </div>
      )}

      {/* Site list */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl shimmer" />)}
        </div>
      ) : sites.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-16 text-center"
          style={{ backgroundColor: "var(--midnight-card)", border: "1px dashed var(--border)" }}
        >
          <Radio size={36} className="mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--praxeti)" }}>No sources added yet</p>
          <p className="text-xs mb-4 max-w-xs" style={{ color: "var(--text-muted)" }}>
            Add company career pages to monitor them automatically for new job listings.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: "var(--spring)", color: "var(--midnight)" }}
          >
            <Plus size={14} /> Add your first source
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => (
            <SourceRow key={site.id} site={site} onUpdate={updateSite} onDelete={removeSite} />
          ))}
        </div>
      )}

      {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} onAdd={addSite} />}
    </div>
  );
}
