"use client";

import { useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  Trash2,
  AlertCircle,
  Loader2,
  X,
  ChevronDown,
  User,
  Briefcase,
  GraduationCap,
  Code,
  Star,
  Calendar,
} from "lucide-react";
import clsx from "clsx";
import {
  fetchResumes,
  uploadResume,
  deleteResume,
  Resume,
  JobType,
  getJobTypeBadgeClass,
  formatDate,
} from "@/lib/api";

const JOB_TYPES: JobType[] = ["SWE", "DE", "DA", "DS", "MLE", "AIE"];

function ResumeDetailPanel({
  resume,
  onClose,
}: {
  resume: Resume;
  onClose: () => void;
}) {
  const parsed = resume.parsed_data;
  const contact = parsed?.contact;
  const skills = parsed?.skills ?? [];
  const experience = parsed?.experience ?? [];
  const education = parsed?.education ?? [];
  const scoredJobs = resume.scored_jobs ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end p-0">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg h-full bg-slate-800 border-l border-slate-700 shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <FileText size={16} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 truncate max-w-56">
                {resume.filename}
              </h2>
              <p className="text-xs text-slate-500">
                {formatDate(resume.upload_date)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Category */}
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                "badge",
                getJobTypeBadgeClass(resume.category)
              )}
            >
              {resume.category}
            </span>
          </div>

          {/* Contact Info */}
          {contact && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                <User size={12} />
                Contact Information
              </h3>
              <div className="space-y-1.5">
                {contact.name && (
                  <p className="text-sm text-slate-200 font-medium">
                    {contact.name}
                  </p>
                )}
                {contact.email && (
                  <p className="text-xs text-slate-400">{contact.email}</p>
                )}
                {contact.phone && (
                  <p className="text-xs text-slate-400">{contact.phone}</p>
                )}
                {contact.location && (
                  <p className="text-xs text-slate-400">{contact.location}</p>
                )}
                {contact.linkedin && (
                  <a
                    href={contact.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 block truncate"
                  >
                    {contact.linkedin}
                  </a>
                )}
                {contact.github && (
                  <a
                    href={contact.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 block truncate"
                  >
                    {contact.github}
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Code size={12} />
                Skills ({skills.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="badge bg-slate-700/60 text-slate-300 border border-slate-600/50 text-xs"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Experience */}
          {experience.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Briefcase size={12} />
                Experience
              </h3>
              <div className="space-y-4">
                {experience.map((exp, i) => (
                  <div
                    key={i}
                    className="relative pl-4 border-l-2 border-slate-700"
                  >
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-indigo-500/60 border border-indigo-400" />
                    <p className="text-sm font-medium text-slate-200">
                      {exp.title}
                    </p>
                    <p className="text-xs text-slate-400">{exp.company}</p>
                    <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                      <Calendar size={10} />
                      {exp.start_date}
                      {exp.end_date ? ` – ${exp.end_date}` : " – Present"}
                    </p>
                    {exp.description && (
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Education */}
          {education.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                <GraduationCap size={12} />
                Education
              </h3>
              <div className="space-y-3">
                {education.map((edu, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-slate-200">
                      {edu.degree}
                    </p>
                    <p className="text-xs text-slate-400">{edu.institution}</p>
                    {edu.year && (
                      <p className="text-xs text-slate-600">{edu.year}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Scored jobs */}
          {scoredJobs.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Star size={12} />
                ATS Scores
              </h3>
              <div className="space-y-2">
                {scoredJobs.map((sj) => (
                  <div
                    key={sj.job_id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-400 truncate flex-1 mr-2">
                      {sj.job_title}
                    </span>
                    <span
                      className={clsx(
                        "font-semibold flex-shrink-0",
                        sj.score >= 80
                          ? "text-green-400"
                          : sj.score >= 60
                          ? "text-yellow-400"
                          : "text-red-400"
                      )}
                    >
                      {sj.score}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!parsed && (
            <div className="text-center py-8 text-slate-600">
              <p className="text-sm">No parsed data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadZone({
  onUpload,
  category,
  onCategoryChange,
  uploading,
}: {
  onUpload: (files: File[]) => void;
  category: JobType;
  onCategoryChange: (c: JobType) => void;
  uploading: boolean;
}) {
  const { getRootProps, getInputProps, isDragActive, acceptedFiles } =
    useDropzone({
      accept: {
        "application/pdf": [".pdf"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          [".docx"],
        "application/msword": [".doc"],
      },
      maxFiles: 5,
      disabled: uploading,
      onDrop: onUpload,
    });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={clsx(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-slate-600 hover:border-slate-500 bg-slate-800/50",
          uploading && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <Loader2 size={28} className="text-indigo-400 animate-spin" />
          ) : (
            <Upload
              size={28}
              className={isDragActive ? "text-indigo-400" : "text-slate-500"}
            />
          )}
          <div>
            <p
              className={clsx(
                "text-sm font-medium",
                isDragActive ? "text-indigo-300" : "text-slate-300"
              )}
            >
              {uploading
                ? "Uploading..."
                : isDragActive
                ? "Drop files here"
                : "Drag & drop resume files"}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              PDF or DOCX • Up to 5 files
            </p>
          </div>
          {!isDragActive && !uploading && (
            <button
              type="button"
              className="px-4 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-xs font-medium hover:bg-indigo-600/30 transition-colors"
            >
              Browse Files
            </button>
          )}
        </div>
      </div>

      {/* Category selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-500 flex-shrink-0">
          Resume Category:
        </label>
        <div className="relative">
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as JobType)}
            className="appearance-none bg-slate-700/60 border border-slate-600/50 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [category, setCategory] = useState<JobType>("SWE");
  const [selected, setSelected] = useState<Resume | null>(null);

  const loadResumes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchResumes();
      setResumes(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load resumes"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  const handleUpload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    const results: Resume[] = [];
    for (const file of files) {
      try {
        const resume = await uploadResume(file, category);
        results.push(resume);
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : `Failed to upload ${file.name}`
        );
      }
    }
    setResumes((prev) => [...results, ...prev]);
    setUploading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this resume?")) return;
    try {
      await deleteResume(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Resumes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Upload and manage your resume library
        </p>
      </div>

      {/* Upload zone */}
      <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">
          Upload New Resume
        </h2>
        <UploadZone
          onUpload={handleUpload}
          category={category}
          onCategoryChange={setCategory}
          uploading={uploading}
        />
        {uploadError && (
          <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
            <X size={12} />
            {uploadError}
          </p>
        )}
      </div>

      {/* Resume list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">
            Your Resumes ({resumes.length})
          </h2>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-48 bg-slate-800 rounded-xl shimmer border border-slate-700/50"
              />
            ))}
          </div>
        ) : resumes.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-600 gap-3">
            <FileText size={40} className="text-slate-700" />
            <p className="text-base font-medium text-slate-500">
              No resumes uploaded yet
            </p>
            <p className="text-sm text-slate-600">
              Upload your first resume above to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {resumes.map((resume) => {
              const skills = resume.parsed_data?.skills ?? [];
              const scoredJobs = resume.scored_jobs ?? [];

              return (
                <div
                  key={resume.id}
                  className="bg-slate-800 border border-slate-700/60 rounded-xl p-5 hover:border-slate-600 transition-all group flex flex-col gap-3"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0">
                      <FileText size={18} className="text-slate-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {resume.filename}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(resume.upload_date)}
                      </p>
                    </div>
                    <span
                      className={clsx(
                        "badge flex-shrink-0",
                        getJobTypeBadgeClass(resume.category)
                      )}
                    >
                      {resume.category}
                    </span>
                  </div>

                  {/* Skills preview */}
                  {skills.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-600 mb-1.5">
                        Top Skills:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {skills.slice(0, 5).map((skill) => (
                          <span
                            key={skill}
                            className="badge bg-slate-700/60 text-slate-400 border border-slate-600/40 text-xs"
                          >
                            {skill}
                          </span>
                        ))}
                        {skills.length > 5 && (
                          <span className="text-xs text-slate-600">
                            +{skills.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scored jobs */}
                  {scoredJobs.length > 0 && (
                    <div className="text-xs text-slate-500">
                      Scored against {scoredJobs.length} job
                      {scoredJobs.length !== 1 ? "s" : ""}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setSelected(resume)}
                      className="flex-1 py-1.5 rounded-lg bg-indigo-600/15 text-indigo-400 border border-indigo-500/25 hover:bg-indigo-600/25 text-xs font-medium transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleDelete(resume.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Delete resume"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <ResumeDetailPanel
          resume={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
