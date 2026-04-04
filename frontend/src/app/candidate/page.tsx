"use client";

import { useEffect, useState, useCallback } from "react";
import {
  User,
  Mail,
  Phone,
  Linkedin,
  Github,
  Globe,
  MapPin,
  DollarSign,
  FileText,
  Brain,
  Shield,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Lock,
} from "lucide-react";
import clsx from "clsx";
import {
  fetchCandidateProfile,
  saveCandidateProfile,
  CandidateProfile,
  JobType,
} from "@/lib/api";

const JOB_TYPES: JobType[] = ["SWE", "DE", "DA", "DS", "MLE", "AIE"];

const WORK_AUTH_OPTIONS = [
  "US Citizen",
  "Permanent Resident (Green Card)",
  "H1B Visa",
  "F1 / OPT",
  "TN Visa",
  "EAD / Other Work Visa",
  "No Sponsorship Needed",
  "Not Applicable",
];

const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD", "SGD"];

const EMPTY_PROFILE: CandidateProfile = {
  full_name: "",
  email: "",
  phone: "",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  current_location: "",
  willing_to_relocate: false,
  work_authorization: "Not Applicable",
  desired_roles: [],
  salary_min: undefined,
  salary_max: undefined,
  salary_currency: "USD",
  cover_letter_template: "",
  autofill_context: "",
};

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <Icon size={15} className="text-indigo-400" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5">
        {label}
        {hint && <span className="ml-1 text-slate-600">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2.5 bg-slate-900/60 border border-slate-600/60 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

export default function CandidatePage() {
  const [profile, setProfile] = useState<CandidateProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCandidateProfile();
      if (data) setProfile(data);
    } catch {
      // Backend not available — start with empty form
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const saved = await saveCandidateProfile(profile);
      setProfile(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: JobType) => {
    setProfile((prev) => ({
      ...prev,
      desired_roles: prev.desired_roles.includes(role)
        ? prev.desired_roles.filter((r) => r !== role)
        : [...prev.desired_roles, role],
    }));
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 size={24} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Candidate Memory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Personal info used for autofill and AI context. Never sent externally.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
          <Lock size={11} />
          Local only — stored in SQLite on this machine
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal Info */}
        <Section icon={User} title="Personal Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name" hint="used in application forms">
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, full_name: e.target.value }))
                }
                placeholder="Lionel Chen"
                className={inputClass}
              />
            </Field>
            <Field label="Email" hint="primary contact email">
              <input
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="lionel@example.com"
                className={inputClass}
              />
            </Field>
            <Field label="Phone" hint="with country code">
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="+1 (555) 000-0000"
                className={inputClass}
              />
            </Field>
            <Field label="Current Location" hint="city, state/country">
              <input
                type="text"
                value={profile.current_location}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, current_location: e.target.value }))
                }
                placeholder="San Francisco, CA"
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        {/* Online Presence */}
        <Section icon={Globe} title="Online Presence">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="LinkedIn URL">
              <div className="relative">
                <Linkedin
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="url"
                  value={profile.linkedin_url}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, linkedin_url: e.target.value }))
                  }
                  placeholder="https://linkedin.com/in/lionel"
                  className={clsx(inputClass, "pl-9")}
                />
              </div>
            </Field>
            <Field label="GitHub URL">
              <div className="relative">
                <Github
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="url"
                  value={profile.github_url}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, github_url: e.target.value }))
                  }
                  placeholder="https://github.com/LionelCCC"
                  className={clsx(inputClass, "pl-9")}
                />
              </div>
            </Field>
            <Field label="Portfolio / Website">
              <div className="relative">
                <Globe
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="url"
                  value={profile.portfolio_url}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, portfolio_url: e.target.value }))
                  }
                  placeholder="https://lionel.dev"
                  className={clsx(inputClass, "pl-9")}
                />
              </div>
            </Field>
          </div>
        </Section>

        {/* Work Preferences */}
        <Section icon={MapPin} title="Work Preferences">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Work Authorization">
                <select
                  value={profile.work_authorization}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      work_authorization: e.target.value,
                    }))
                  }
                  className={clsx(
                    inputClass,
                    "appearance-none cursor-pointer"
                  )}
                >
                  {WORK_AUTH_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Willing to Relocate">
                <div className="flex items-center gap-3 h-10">
                  <button
                    type="button"
                    onClick={() =>
                      setProfile((p) => ({
                        ...p,
                        willing_to_relocate: !p.willing_to_relocate,
                      }))
                    }
                    className={clsx(
                      "relative w-11 h-6 rounded-full transition-colors",
                      profile.willing_to_relocate
                        ? "bg-indigo-600"
                        : "bg-slate-600"
                    )}
                  >
                    <span
                      className={clsx(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                        profile.willing_to_relocate
                          ? "translate-x-6"
                          : "translate-x-1"
                      )}
                    />
                  </button>
                  <span className="text-sm text-slate-300">
                    {profile.willing_to_relocate ? "Yes" : "No"}
                  </span>
                </div>
              </Field>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-2">
                Target Roles
              </label>
              <div className="flex flex-wrap gap-2">
                {JOB_TYPES.map((role) => {
                  const active = profile.desired_roles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        active
                          ? "bg-indigo-600/25 text-indigo-300 border-indigo-500/50"
                          : "bg-slate-700/40 text-slate-400 border-slate-600/50 hover:border-slate-500"
                      )}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        {/* Compensation */}
        <Section icon={DollarSign} title="Compensation Expectations">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Minimum Salary" hint="annual">
              <input
                type="number"
                value={profile.salary_min ?? ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    salary_min: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  }))
                }
                placeholder="80000"
                min={0}
                className={inputClass}
              />
            </Field>
            <Field label="Maximum Salary" hint="annual">
              <input
                type="number"
                value={profile.salary_max ?? ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    salary_max: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  }))
                }
                placeholder="150000"
                min={0}
                className={inputClass}
              />
            </Field>
            <Field label="Currency">
              <select
                value={profile.salary_currency}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    salary_currency: e.target.value,
                  }))
                }
                className={clsx(inputClass, "appearance-none cursor-pointer")}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* AI Context */}
        <Section icon={Brain} title="AI Autofill Context">
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-xs text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 rounded-lg px-3 py-2.5">
              <Brain size={13} className="mt-0.5 flex-shrink-0" />
              <span>
                This context is injected into Claude when generating cover
                letters, answering &quot;Why do you want to work here?&quot; questions, and
                filling open-ended application fields. Be specific and honest.
              </span>
            </div>

            <Field
              label="Cover Letter Template"
              hint="Claude will customize this per job — use [COMPANY] and [ROLE] as placeholders"
            >
              <textarea
                value={profile.cover_letter_template}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    cover_letter_template: e.target.value,
                  }))
                }
                placeholder={`Dear Hiring Manager,\n\nI am writing to express my interest in the [ROLE] position at [COMPANY].\n\n[PERSONALIZATION]\n\nThank you for your consideration.\n\nSincerely,\n${profile.full_name || "Your Name"}`}
                rows={8}
                className={clsx(inputClass, "resize-y font-mono text-xs")}
              />
            </Field>

            <Field
              label="Additional Context for AI"
              hint="years of experience, key projects, what you're looking for, deal-breakers, etc."
            >
              <textarea
                value={profile.autofill_context}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    autofill_context: e.target.value,
                  }))
                }
                placeholder={`Example:\n- 5 years of Python and 3 years of ML engineering experience\n- Worked on recommendation systems handling 10M+ daily users\n- Looking for senior+ roles with strong ML infrastructure focus\n- Prefer remote-first or hybrid; open to SF/NYC/Toronto\n- Not interested in finance or defense industry roles`}
                rows={6}
                className={clsx(inputClass, "resize-y")}
              />
            </Field>
          </div>
        </Section>

        {/* Privacy notice */}
        <div className="flex items-start gap-3 bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
          <Shield size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-slate-500 space-y-1">
            <p className="text-slate-400 font-medium">
              Your data stays on this machine
            </p>
            <p>
              This profile is saved to a local SQLite database at{" "}
              <code className="text-slate-400 bg-slate-700/50 px-1 rounded">
                jobs.db
              </code>
              . It is only read by the local backend to fill application forms
              via Playwright or to provide context to Claude AI when you
              explicitly trigger those features. No data is sent to any cloud
              service, analytics platform, or third party.
            </p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saveError && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle size={13} />
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-2 text-xs text-green-400">
              <CheckCircle size={13} />
              Saved successfully
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle size={14} />
            ) : (
              <Save size={14} />
            )}
            {saving ? "Saving…" : saveSuccess ? "Saved!" : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
