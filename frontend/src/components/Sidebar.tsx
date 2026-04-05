"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  ClipboardList,
  Rocket,
  User,
  ChevronRight,
  Radio,
  Brain,
  Target,
} from "lucide-react";
import clsx from "clsx";

// ─── Core pipeline stages ─────────────────────────────────────────────────────
const PIPELINE_ITEMS = [
  { label: "Resume",      href: "/resumes",      icon: FileText,       step: 1 },
  { label: "Discovery",   href: "/jobs",         icon: Briefcase,      step: 2 },
  { label: "Scoring",     href: "/scoring",      icon: Target,         step: 3 },
  { label: "Application", href: "/applications", icon: ClipboardList,  step: 4 },
];

// ─── Supporting tools ─────────────────────────────────────────────────────────
const TOOL_ITEMS = [
  { label: "Candidate Memory", href: "/candidate", icon: Brain },
  { label: "Sources",          href: "/sources",   icon: Radio },
  { label: "Dashboard",        href: "/",          icon: LayoutDashboard },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 flex flex-col z-50"
      style={{
        backgroundColor: "var(--midnight-deep)",
        borderRight: "1px solid rgba(30,72,143,0.35)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-6 py-5"
        style={{ borderBottom: "1px solid rgba(30,72,143,0.35)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "var(--spring)" }}
        >
          <Rocket className="w-4 h-4" style={{ color: "var(--midnight)" }} />
        </div>
        <span className="text-lg font-bold tracking-tight" style={{ color: "var(--praxeti)" }}>
          JobPilot
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">

        {/* ── Core Pipeline ── */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider px-3 mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Core Pipeline
          </p>
          <div className="space-y-0.5">
            {PIPELINE_ITEMS.map(({ label, href, icon: Icon, step }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                  )}
                  style={
                    active
                      ? {
                          backgroundColor: "rgba(219,230,76,0.12)",
                          color: "var(--spring)",
                          border: "1px solid rgba(219,230,76,0.30)",
                        }
                      : {
                          color: "var(--text-secondary)",
                          border: "1px solid transparent",
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = "var(--praxeti)";
                      (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(30,72,143,0.18)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    }
                  }}
                >
                  {/* Step number circle */}
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={
                      active
                        ? { backgroundColor: "var(--spring)", color: "var(--midnight)" }
                        : { backgroundColor: "rgba(30,72,143,0.30)", color: "var(--text-muted)" }
                    }
                  >
                    {step}
                  </div>
                  <Icon
                    size={16}
                    className="flex-shrink-0"
                    style={{ color: active ? "var(--spring)" : "var(--text-muted)" }}
                  />
                  <span className="flex-1">{label}</span>
                  {active && (
                    <ChevronRight size={13} style={{ color: "var(--spring)" }} />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Supporting Tools ── */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider px-3 mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Tools
          </p>
          <div className="space-y-0.5">
            {TOOL_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                  style={
                    active
                      ? {
                          backgroundColor: "rgba(30,72,143,0.22)",
                          color: "var(--nuit-light)",
                          border: "1px solid rgba(30,72,143,0.45)",
                        }
                      : {
                          color: "var(--text-secondary)",
                          border: "1px solid transparent",
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = "var(--praxeti)";
                      (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(30,72,143,0.18)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <Icon
                    size={16}
                    className="flex-shrink-0"
                    style={{ color: active ? "var(--nuit-light)" : "var(--text-muted)" }}
                  />
                  <span className="flex-1">{label}</span>
                  {active && (
                    <ChevronRight size={13} style={{ color: "var(--nuit-light)" }} />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* User section */}
      <div
        className="px-3 py-4"
        style={{ borderTop: "1px solid rgba(30,72,143,0.35)" }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{
            backgroundColor: "rgba(30,72,143,0.18)",
            border: "1px solid rgba(30,72,143,0.30)",
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--nuit), var(--bookgreen))",
            }}
          >
            <User className="w-4 h-4" style={{ color: "var(--praxeti)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--praxeti)" }}>
              Lionel
            </p>
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              Job Seeker
            </p>
          </div>
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: "var(--mantis)" }}
          />
        </div>
      </div>
    </aside>
  );
}
