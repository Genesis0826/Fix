"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, MapPin, Clock, Building2, Briefcase,
  DollarSign, SlidersHorizontal, Bookmark, CheckCircle,
  Loader2, Calendar, CalendarX2, X, ArrowRight, Zap,
  Sparkles, TrendingUp, Users, ChevronRight, Check, Upload, Trash2,
} from "lucide-react";
import {
  getApplicantJobs, applyToJob, getMyApplications, getJobQuestions, getApplicantProfile,
  uploadApplicantResume, deleteApplicantResume,
  type JobPosting, type ApplicationQuestion, type ApplicantProfile,
} from "@/lib/authApi";
import { getUserInfo, getAccessToken, parseJwt } from "@/lib/authStorage";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function isNewJob(postedAt: string): boolean {
  return (Date.now() - new Date(postedAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ─── Application Form ─────────────────────────────────────────────────────────

function ApplicationForm({
  job,
  profile,
  onProfileUpdate,
  onClose,
  onApplied,
}: {
  job: JobPosting;
  profile: ApplicantProfile | null;
  onProfileUpdate: (profile: ApplicantProfile) => void;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [deletingResume, setDeletingResume] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);

  const jwt = parseJwt(getAccessToken() ?? "");
  const userInfo = getUserInfo();
  const autoFill = {
    first_name:   jwt?.first_name   ?? "",
    last_name:    jwt?.last_name    ?? "",
    email:        userInfo?.email   ?? jwt?.email ?? "",
    phone_number: jwt?.phone_number ?? "",
  };

  useEffect(() => {
    getJobQuestions(job.job_posting_id)
      .then(setQuestions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [job.job_posting_id]);

  const setAnswer = (questionId: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

  const toggleCheckbox = (questionId: string, optIndex: number) => {
    const current = (() => {
      try { return JSON.parse(answers[questionId] ?? "[]") as number[]; }
      catch { return [] as number[]; }
    })();
    const next = current.includes(optIndex) ? current.filter((i) => i !== optIndex) : [...current, optIndex];
    setAnswer(questionId, JSON.stringify(next));
  };

  const checkedIndices = (questionId: string): number[] => {
    try { return JSON.parse(answers[questionId] ?? "[]") as number[]; }
    catch { return []; }
  };

  const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!profile) {
      toast.error("Profile not loaded. Please refresh and try again.");
      e.target.value = "";
      return;
    }

    setUploadingResume(true);
    try {
      const uploaded = await uploadApplicantResume(file);
      onProfileUpdate({
        ...profile,
        resume_url: uploaded.resume_url,
        resume_name: uploaded.resume_name,
        resume_uploaded_at: uploaded.resume_uploaded_at,
      });
      toast.success("Resume uploaded successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload resume");
    } finally {
      e.target.value = "";
      setUploadingResume(false);
    }
  };

  const handleRemoveResume = async () => {
    if (!profile) {
      toast.error("Profile not loaded. Please refresh and try again.");
      return;
    }

    setDeletingResume(true);
    try {
      await deleteApplicantResume();
      onProfileUpdate({
        ...profile,
        resume_url: null,
        resume_name: null,
        resume_uploaded_at: null,
      });
      toast.success("Resume removed.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove resume");
    } finally {
      setDeletingResume(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const q of questions) {
      if (!q.is_required) continue;
      const val = answers[q.question_id];
      if (!val || (q.question_type === "checkbox" && JSON.parse(val ?? "[]").length === 0)) {
        toast.error(`Please answer: "${q.question_text}"`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const answerPayload = questions.map((q) => {
        let answer_value = answers[q.question_id] ?? "";
        if (q.question_type === "multiple_choice" && answer_value !== "") {
          const idx = Number.parseInt(answer_value, 10);
          answer_value = q.options?.[idx] ?? answer_value;
        }
        if (q.question_type === "checkbox" && answer_value) {
          try {
            const indices = JSON.parse(answer_value) as number[];
            answer_value = JSON.stringify(indices.map((i) => q.options?.[i] ?? "").filter(Boolean));
          } catch { answer_value = ""; }
        }
        return { question_id: q.question_id, answer_value };
      }).filter((a) => a.answer_value !== "");

      await applyToJob(job.job_posting_id, answerPayload.length ? { answers: answerPayload } : undefined);
      toast.success("Application submitted!");
      onApplied();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  };

  const hasQuestions = !loading && questions.length > 0;
  const totalSteps = hasQuestions ? 2 : 1;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal gradient header */}
        <div className="relative bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_60%,#134e4a_100%)] px-6 py-5 shrink-0">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Submitting for</p>
              <h3 className="font-bold text-lg text-white leading-tight">{job.title}</h3>
              <p className="text-xs text-white/50 mt-0.5">Complete the form below to submit your application</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 transition-colors shrink-0 mt-0.5 cursor-pointer">
              <X className="h-4 w-4 text-white/70" />
            </button>
          </div>

          {hasQuestions && (
            <div className="relative mt-4 flex items-center gap-2">
              {[
                { step: 1, label: "Your Info" },
                { step: 2, label: "Questions" },
              ].map(({ step, label }, idx) => (
                <div key={step} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/20 bg-white/10 text-[10px] font-bold text-white/80">
                    <span className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center text-[9px]">{step}</span>
                    {label}
                  </div>
                  {idx < 1 && <div className="h-px w-4 bg-white/20" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">First Name</label>
                <Input value={autoFill.first_name} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Last Name</label>
                <Input value={autoFill.last_name} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed text-xs" />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Email</label>
              <Input value={autoFill.email} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed text-xs" />
            </div>
            {autoFill.phone_number && (
              <div className="mt-3 space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Phone Number</label>
                <Input value={autoFill.phone_number} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed text-xs" />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/50 mt-2">Pulled from your account profile.</p>
          </div>

          <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Resume (optional)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Upload PDF, DOC, or DOCX format.</p>
              </div>
              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleResumeFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => resumeInputRef.current?.click()}
                disabled={uploadingResume || deletingResume || submitting}
                className="h-8 gap-1.5"
              >
                {uploadingResume ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadingResume ? "Uploading..." : (profile?.resume_url ? "Replace" : "Upload")}
              </Button>
            </div>

            {profile?.resume_url && (
              <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground truncate">
                    {profile.resume_name || "Uploaded resume"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => window.open(profile.resume_url!, "_blank", "noopener,noreferrer")}
                    >
                      View
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={handleRemoveResume}
                      disabled={deletingResume || uploadingResume || submitting}
                    >
                      {deletingResume ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : questions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Application Questions</p>
              <div className="space-y-5">
                {questions.map((q) => (
                  <div key={q.question_id} className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">
                      {q.question_text}
                      {q.is_required && <span className="text-destructive ml-1">*</span>}
                    </label>
                    {q.question_type === "text" && (
                      <textarea
                        value={answers[q.question_id] ?? ""}
                        onChange={(e) => setAnswer(q.question_id, e.target.value)}
                        placeholder="Your answer..."
                        required={q.is_required}
                        rows={3}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
                      />
                    )}
                    {q.question_type === "multiple_choice" && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className="flex items-center gap-2.5 cursor-pointer group">
                            <input type="radio" name={q.question_id} value={String(oi)}
                              checked={answers[q.question_id] === String(oi)}
                              onChange={() => setAnswer(q.question_id, String(oi))}
                              required={q.is_required} className="h-4 w-4 text-primary" />
                            <span className="text-sm text-foreground group-hover:text-primary transition-colors">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {q.question_type === "checkbox" && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className="flex items-center gap-2.5 cursor-pointer group">
                            <input type="checkbox" checked={checkedIndices(q.question_id).includes(oi)}
                              onChange={() => toggleCheckbox(q.question_id, oi)}
                              className="h-4 w-4 rounded text-primary" />
                            <span className="text-sm text-foreground group-hover:text-primary transition-colors">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2 pb-1">
            <Button type="button" variant="outline" className="flex-1 h-10" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" className="flex-1 h-10 gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-4 w-4" /> Submit Application</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApplicantJobsPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [locationFilter, setLocationFilter] = useState("All Locations");
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [displayedJob, setDisplayedJob] = useState<JobPosting | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [applyingJob, setApplyingJob] = useState<JobPosting | null>(null);
  const [applicantProfile, setApplicantProfile] = useState<ApplicantProfile | null>(null);

  useEffect(() => {
    Promise.all([
      getApplicantJobs().catch(() => [] as JobPosting[]),
      getMyApplications().catch(() => []),
      getApplicantProfile().catch(() => null),
    ]).then(([fetchedJobs, myApps, ap]) => {
      setJobs(fetchedJobs);
      setAppliedJobIds(new Set(myApps.map((a: any) => a.job_posting_id)));
      setApplicantProfile(ap);
    }).finally(() => setLoading(false));
  }, []);

  const profileComplete = !!(
    applicantProfile?.first_name?.trim() &&
    applicantProfile?.last_name?.trim() &&
    applicantProfile?.phone_number?.trim()
  );

  const handleApply = (job: JobPosting) => {
    if (!profileComplete) {
      toast.error("Please complete your profile before applying.", {
        description: "Go to My Profile and fill in your name and phone number.",
        action: { label: "Go to Profile", onClick: () => window.location.href = "/applicant/profile" },
      });
      return;
    }
    setApplyingJob(job);
  };

  const jobTypes = useMemo(() => {
    const types = new Set(jobs.map((j) => j.employment_type).filter(Boolean) as string[]);
    return ["All Types", ...Array.from(types)];
  }, [jobs]);

  const locations = useMemo(() => {
    const locs = new Set(jobs.map((j) => j.location).filter(Boolean) as string[]);
    return ["All Locations", ...Array.from(locs)];
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch = !q || job.title.toLowerCase().includes(q) || (job.description ?? "").toLowerCase().includes(q);
      const matchesType = typeFilter === "All Types" || job.employment_type === typeFilter;
      const matchesLocation = locationFilter === "All Locations" || job.location === locationFilter;
      return matchesSearch && matchesType && matchesLocation;
    });
  }, [jobs, search, typeFilter, locationFilter]);

  useEffect(() => {
    if (selectedJob && !filtered.find((j) => j.job_posting_id === selectedJob.job_posting_id)) {
      setDetailVisible(false);
      setTimeout(() => { setSelectedJob(null); setDisplayedJob(null); }, 150);
    }
  }, [filtered, selectedJob]);

  const selectJob = (job: JobPosting) => {
    setSelectedJob(job);
    if (detailVisible) {
      setDetailVisible(false);
      setTimeout(() => {
        setDisplayedJob(job);
        requestAnimationFrame(() => requestAnimationFrame(() => setDetailVisible(true)));
      }, 150);
    } else {
      setDisplayedJob(job);
      requestAnimationFrame(() => requestAnimationFrame(() => setDetailVisible(true)));
    }
  };

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isApplied = displayedJob ? appliedJobIds.has(displayedJob.job_posting_id) : false;
  const activeFilters = (typeFilter !== "All Types" ? 1 : 0) + (locationFilter !== "All Locations" ? 1 : 0);
  const hasActiveFilter = search.trim().length > 0 || activeFilters > 0;

  return (
    <div className="space-y-0 max-w-300 mx-auto animate-in fade-in duration-500">

      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#172554_45%,#134e4a_100%)] mb-5">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-blue-500 blur-[80px] opacity-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-teal-400 blur-[80px] opacity-15 pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 h-32 w-32 rounded-full bg-indigo-400 blur-[80px] opacity-10 pointer-events-none" />

        <div className="relative px-8 pt-8 pb-6">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/8 border border-white/12 mb-3">
                <Sparkles className="h-3 w-3 text-teal-300" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Opportunities</span>
              </div>
              <h1 className="text-3xl font-bold text-white leading-tight">
                Find Your Next<br />
                <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-300 to-teal-300">Great Role</span>
              </h1>
              <p className="text-sm text-white/50 mt-2 max-w-sm">
                Browse open positions and take the next step in your career journey.
              </p>
            </div>

            {!loading && (
              <div className="flex gap-3 shrink-0">
                <div className="flex flex-col items-center justify-center rounded-xl border border-white/12 bg-white/6 px-5 py-3.5 text-center backdrop-blur-sm">
                  {hasActiveFilter ? (
                    <>
                      <p className="text-2xl font-bold text-white">{filtered.length}</p>
                      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mt-0.5">
                        {filtered.length === 1 ? "Match" : "Matches"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-white">{jobs.length}</p>
                      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mt-0.5">Open Roles</p>
                    </>
                  )}
                </div>
                {appliedJobIds.size > 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-green-400/20 bg-green-500/10 px-5 py-3.5 text-center backdrop-blur-sm">
                    <p className="text-2xl font-bold text-green-300">{appliedJobIds.size}</p>
                    <p className="text-[10px] font-semibold text-green-400/60 uppercase tracking-wide mt-0.5">Applied</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by job title, keyword, or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/8 border border-white/15 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/30 focus:bg-white/12 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                <X className="h-3.5 w-3.5 text-white/40" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body: Filters + List + Detail ──────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* ── Filter Sidebar ──────────────────────────────────────────────── */}
        <div className="w-48 shrink-0 space-y-3">
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-bold text-foreground uppercase tracking-widest">Filters</span>
              {activeFilters > 0 && (
                <span className="ml-auto flex items-center justify-center h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{activeFilters}</span>
              )}
            </div>

            <div className="px-3 py-3 space-y-4">
              {/* Job Type */}
              <div className="space-y-1.5">
                <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest px-1">Job Type</p>
                {jobTypes.map((t) => {
                  const count = t === "All Types" ? jobs.length : jobs.filter(j => j.employment_type === t).length;
                  return (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        typeFilter === t
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-transparent text-muted-foreground border-transparent hover:border-border hover:bg-muted/40 hover:text-foreground"
                      }`}
                    >
                      <span>{t === "All Types" ? "All" : t}</span>
                      <span className={`text-[10px] font-bold tabular-nums ${typeFilter === t ? "text-primary-foreground/70" : "text-muted-foreground/50"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-border" />

              {/* Location */}
              <div className="space-y-1.5">
                <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest px-1">Location</p>
                {locations.map((l) => {
                  const count = l === "All Locations" ? jobs.length : jobs.filter(j => j.location === l).length;
                  return (
                    <button
                      key={l}
                      onClick={() => setLocationFilter(l)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        locationFilter === l
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-transparent text-muted-foreground border-transparent hover:border-border hover:bg-muted/40 hover:text-foreground"
                      }`}
                    >
                      <span className="truncate pr-1">{l === "All Locations" ? "All" : l}</span>
                      <span className={`text-[10px] font-bold tabular-nums shrink-0 ${locationFilter === l ? "text-primary-foreground/70" : "text-muted-foreground/50"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clear filters */}
            {activeFilters > 0 && (
              <div className="px-3 pb-3">
                <button
                  onClick={() => { setTypeFilter("All Types"); setLocationFilter("All Locations"); }}
                  className="w-full h-7 rounded-lg text-[11px] font-semibold text-muted-foreground border border-border hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* Bookmarks chip */}
          {bookmarked.size > 0 && (
            <div className="rounded-xl border border-amber-200/40 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-500/20 px-3 py-2.5 flex items-center gap-2">
              <Bookmark className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{bookmarked.size} saved</p>
                <p className="text-[10px] text-amber-600/60 dark:text-amber-400/50">Bookmarked roles</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Job List ────────────────────────────────────────────────────── */}
        <div className="w-75 shrink-0 space-y-2">
          <div className="flex items-center justify-between px-1 pb-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {loading ? "Loading…" : `${filtered.length} position${filtered.length !== 1 ? "s" : ""}`}
            </p>
            {filtered.length !== jobs.length && (
              <span className="text-[10px] text-muted-foreground/60">filtered</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground/40">Loading positions…</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted/40 border border-border flex items-center justify-center">
                <Search className="h-5 w-5 text-muted-foreground/30" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">{jobs.length === 0 ? "No openings yet" : "No matches"}</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-45">
                  {jobs.length === 0 ? "Check back soon for new opportunities" : "Try adjusting your search or filters"}
                </p>
              </div>
            </div>
          ) : (
            filtered.map((job, idx) => {
              const isSelected = selectedJob?.job_posting_id === job.job_posting_id;
              const applied = appliedJobIds.has(job.job_posting_id);
              const isBookmarked = bookmarked.has(job.job_posting_id);
              const isNew = isNewJob(job.posted_at);

              return (
                <div
                  key={job.job_posting_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectJob(job)}
                  onKeyDown={(e) => e.key === "Enter" && selectJob(job)}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className={`relative w-full text-left rounded-xl border p-4 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-1 duration-300 ${
                    isSelected
                      ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10"
                      : "border-border bg-card hover:border-primary/30 hover:shadow-sm hover:-translate-y-px"
                  }`}
                >
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute left-0 top-3 bottom-3 w-0.75 rounded-full bg-linear-to-b from-primary to-teal-500" />
                  )}
                  {!isSelected && (
                    <div className="absolute left-0 top-3 bottom-3 w-0.75 rounded-full bg-transparent group-hover:bg-primary/50 transition-colors duration-200" />
                  )}

                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? "bg-primary/15 border-primary/30"
                        : "bg-muted/40 border-border group-hover:bg-primary/8 group-hover:border-primary/20"
                    }`}>
                      <Building2 className={`h-4 w-4 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary/70"}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 className={`font-bold text-sm leading-tight truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {job.title}
                        </h3>
                        <div className="flex items-center gap-1 shrink-0">
                          {isNew && (
                            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-green-500 text-white shadow-sm">
                              New
                            </span>
                          )}
                          <button
                            onClick={(e) => toggleBookmark(job.job_posting_id, e)}
                            className="p-0.5 rounded-md hover:bg-muted/60 transition-colors cursor-pointer"
                          >
                            <Bookmark className={`h-3.5 w-3.5 transition-all ${isBookmarked ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground"}`} />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {job.employment_type && (
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isSelected ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
                          }`}>
                            {job.employment_type}
                          </span>
                        )}
                        {applied && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                            <CheckCircle className="h-2.5 w-2.5" /> Applied
                          </span>
                        )}
                        {job.salary_range && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground">
                            <DollarSign className="h-2.5 w-2.5" />{job.salary_range}
                          </span>
                        )}
                      </div>

                      {job.description && (
                        <p className="text-[11px] text-muted-foreground/70 leading-snug mt-1.5 line-clamp-2">
                          {job.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {job.location && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate max-w-24">{job.location}</span>
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/50">{timeAgo(job.posted_at)}</span>
                        </div>
                        {job.closes_at && (() => {
                          const d = daysUntil(job.closes_at);
                          if (d < 0) return null;
                          if (d <= 5) return (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0
                              bg-red-50 text-red-600 border border-red-100
                              dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40">
                              <Clock className="h-2.5 w-2.5" /> {d}d left
                            </span>
                          );
                          return (
                            <span className="text-[10px] text-muted-foreground/40 shrink-0">
                              Closes {new Date(job.closes_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className={`absolute right-3 bottom-3 transition-all duration-200 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}>
                    <ChevronRight className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Detail Panel ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {!displayedJob && (
            <div className="flex flex-col items-center justify-center py-28 gap-5 text-muted-foreground">
              <div className="relative">
                <div className="h-20 w-20 rounded-3xl bg-linear-to-br from-muted/60 to-muted/20 border border-border flex items-center justify-center">
                  <Briefcase className="h-9 w-9 opacity-20" />
                </div>
                <div className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 text-primary/50" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-foreground">Select a position</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-50">Click any job to view the full details and apply</p>
              </div>
            </div>
          )}

          {/* Detail card */}
          <div className={`transition-all duration-200 ${detailVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
            {displayedJob && (
              <div className="rounded-2xl border border-border shadow-sm overflow-hidden bg-card">

                {/* ─── Gradient Header ─────────────────────────────────── */}
                <div className="relative bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_55%,#134e4a_100%)] px-6 py-7 overflow-hidden">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                  <div className="absolute -top-12 -right-12 h-52 w-52 rounded-full bg-blue-500 blur-[70px] opacity-20 pointer-events-none" />
                  <div className="absolute bottom-0 left-12 h-36 w-36 rounded-full bg-teal-400 blur-[50px] opacity-12 pointer-events-none" />

                  <div className="relative flex items-start gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                      <Building2 className="h-7 w-7 text-white/50" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/35 mb-1.5">Open Position</p>
                      <h2 className="text-xl font-bold text-white leading-tight">{displayedJob.title}</h2>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-400/30 text-[10px] font-bold text-green-300 uppercase tracking-wide">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                          Accepting Applications
                        </span>
                        {displayedJob.employment_type && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold text-white/75">
                            <Briefcase className="h-3 w-3" />{displayedJob.employment_type}
                          </span>
                        )}
                        {displayedJob.location && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold text-white/75">
                            <MapPin className="h-3 w-3" />{displayedJob.location}
                          </span>
                        )}
                        {isNewJob(displayedJob.posted_at) && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                            Recently Posted
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => toggleBookmark(displayedJob.job_posting_id, e)}
                      className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                    >
                      <Bookmark className={`h-4 w-4 transition-all ${bookmarked.has(displayedJob.job_posting_id) ? "fill-amber-300 text-amber-300 scale-110" : "text-white/50"}`} />
                    </button>
                  </div>

                  {/* Meta strip */}
                  <div className="relative mt-5 flex flex-wrap gap-2">
                    {displayedJob.salary_range && (
                      <div className="inline-flex items-center gap-1.5 bg-white/8 border border-white/12 rounded-xl px-3 py-2">
                        <DollarSign className="h-3.5 w-3.5 text-white/45" />
                        <span className="text-sm font-bold text-white">{displayedJob.salary_range}</span>
                      </div>
                    )}
                    <div className="inline-flex items-center gap-1.5 bg-white/8 border border-white/12 rounded-xl px-3 py-2">
                      <Calendar className="h-3.5 w-3.5 text-white/45" />
                      <span className="text-sm text-white/65">Posted {formatDate(displayedJob.posted_at)}</span>
                    </div>
                    {displayedJob.closes_at && (
                      <div className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-400/25 rounded-xl px-3 py-2">
                        <CalendarX2 className="h-3.5 w-3.5 text-amber-300" />
                        <span className="text-sm font-bold text-amber-200">Closes {formatDate(displayedJob.closes_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="relative mt-5">
                    {isApplied ? (
                      <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500/20 border border-green-400/30 text-green-300 font-semibold text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Application Submitted
                      </div>
                    ) : (
                      <button
                        onClick={() => handleApply(displayedJob)}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-sm hover:bg-white/92 transition-all shadow-lg shadow-black/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md cursor-pointer"
                      >
                        <Zap className="h-4 w-4" />
                        Apply Now
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ─── Body ─────────────────────────────────────────────── */}
                <div className="divide-y divide-border">

                  {/* Description */}
                  {displayedJob.description && (
                    <div className="p-6">
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="h-7 w-7 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                          <Briefcase className="h-3.5 w-3.5 text-primary/70" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground">Job Description</h3>
                      </div>
                      <div className="rounded-xl bg-muted/20 border border-border px-5 py-4">
                        <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{displayedJob.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Quick Summary grid */}
                  <div className="p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-7 w-7 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-3.5 w-3.5 text-primary/70" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Position Overview</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <SummaryCard icon={<Briefcase className="h-4 w-4" />}   label="Employment Type" value={displayedJob.employment_type} />
                      <SummaryCard icon={<MapPin className="h-4 w-4" />}      label="Location"        value={displayedJob.location} />
                      <SummaryCard icon={<DollarSign className="h-4 w-4" />}  label="Salary Range"    value={displayedJob.salary_range} />
                      <SummaryCard icon={<Calendar className="h-4 w-4" />}    label="Date Posted"     value={formatDate(displayedJob.posted_at)} />
                      {displayedJob.closes_at && (
                        <SummaryCard icon={<CalendarX2 className="h-4 w-4" />} label="Application Deadline" value={formatDate(displayedJob.closes_at)} accent="amber" />
                      )}
                      <SummaryCard
                        icon={<Clock className="h-4 w-4" />}
                        label="Hiring Status"
                        value={displayedJob.status === "open" ? "Open — Actively Hiring" : "Closed"}
                        accent={displayedJob.status === "open" ? "green" : undefined}
                      />
                    </div>
                  </div>

                  {/* Bottom CTA strip */}
                  {!isApplied && (
                    <div className="px-6 py-4 bg-linear-to-r from-primary/4 to-teal-500/3 border-t border-border flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="text-xs">Interested? Submit your application today.</span>
                      </div>
                      <button
                        onClick={() => handleApply(displayedJob)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all hover:-translate-y-px shadow-sm hover:shadow cursor-pointer"
                      >
                        Apply Now <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Apply form modal */}
      {applyingJob && (
        <ApplicationForm
          job={applyingJob}
          profile={applicantProfile}
          onProfileUpdate={setApplicantProfile}
          onClose={() => setApplyingJob(null)}
          onApplied={() => {
            setAppliedJobIds((prev) => new Set([...prev, applyingJob.job_posting_id]));
            setApplyingJob(null);
          }}
        />
      )}
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode | string | null | undefined;
  accent?: "green" | "amber";
}) {
  if (!value) return null;
  const containerClass =
    accent === "green" ? "border-green-200/70 bg-green-50/60 dark:border-green-500/20 dark:bg-green-900/10" :
    accent === "amber" ? "border-amber-200/70 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-900/10" :
    "border-border bg-muted/15";
  const iconClass =
    accent === "green" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
    accent === "amber" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
    "bg-primary/8 text-primary";
  const labelClass =
    accent === "green" ? "text-green-600/60 dark:text-green-400/60" :
    accent === "amber" ? "text-amber-600/60 dark:text-amber-400/60" :
    "text-muted-foreground/60";
  const valueClass =
    accent === "green" ? "text-green-700 dark:text-green-300" :
    accent === "amber" ? "text-amber-700 dark:text-amber-300" :
    "text-foreground";

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${containerClass}`}>
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-wide ${labelClass}`}>{label}</p>
        <p className={`text-xs font-semibold mt-0.5 leading-snug ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
