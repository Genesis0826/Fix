"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserInfo, getAccessToken, parseJwt, type StoredUser } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import {
  getApplicantJobs, applyToJob, getMyApplications, getJobQuestions,
  type JobPosting, type ApplicationQuestion, type MyApplication,
} from "@/lib/authApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Check, Briefcase, MapPin, Clock,
  Search, ChevronRight, Building2, X, Loader2, CheckCircle,
  DollarSign, FileText, TrendingUp, CalendarClock, Sparkles,
  ArrowUpRight,
} from "lucide-react";

// ─── Application Form Modal ───────────────────────────────────────────────────

function ApplicationForm({
  job,
  onClose,
  onApplied,
}: {
  job: JobPosting;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQ, setLoadingQ] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      .finally(() => setLoadingQ(false));
  }, [job.job_posting_id]);

  const setAnswer = (qId: string, val: string) =>
    setAnswers((p) => ({ ...p, [qId]: val }));

  const toggleCheckbox = (qId: string, idx: number) => {
    const current: number[] = (() => {
      try { return JSON.parse(answers[qId] ?? "[]"); }
      catch { return []; }
    })();
    const next = current.includes(idx) ? current.filter((i) => i !== idx) : [...current, idx];
    setAnswer(qId, JSON.stringify(next));
  };

  const checkedIndices = (qId: string): number[] => {
    try { return JSON.parse(answers[qId] ?? "[]"); }
    catch { return []; }
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
      const payload = questions.map((q) => {
        let answer_value = answers[q.question_id] ?? "";
        if (q.question_type === "multiple_choice" && answer_value) {
          answer_value = q.options?.[Number.parseInt(answer_value, 10)] ?? answer_value;
        }
        if (q.question_type === "checkbox" && answer_value) {
          try {
            const indices = JSON.parse(answer_value) as number[];
            answer_value = JSON.stringify(indices.map((i) => q.options?.[i] ?? "").filter(Boolean));
          } catch { answer_value = ""; }
        }
        return { question_id: q.question_id, answer_value };
      }).filter((a) => a.answer_value !== "");

      await applyToJob(job.job_posting_id, payload.length ? { answers: payload } : undefined);
      toast.success("Application submitted!");
      onApplied();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  };

  const hasQuestions = !loadingQ && questions.length > 0;
  const totalSteps = hasQuestions ? 2 : 1;
  const [formStep, setFormStep] = useState(1);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Gradient header */}
        <div className="relative bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_60%,#134e4a_100%)] px-6 py-5 shrink-0">
          <div className="absolute inset-0 opacity-[0.03]"
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
              {[1, 2].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold transition-all ${
                    formStep === step
                      ? "bg-white/20 border-white/30 text-white"
                      : formStep > step
                      ? "bg-green-500/30 border-green-400/40 text-green-300"
                      : "bg-white/5 border-white/10 text-white/30"
                  }`}>
                    {formStep > step ? <Check className="h-2.5 w-2.5" /> : <span>{step}</span>}
                    <span>{step === 1 ? "Your Info" : "Questions"}</span>
                  </div>
                  {step < totalSteps && <div className="h-px w-4 bg-white/20" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">First Name</label>
                <Input value={autoFill.first_name} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Last Name</label>
                <Input value={autoFill.last_name} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed" />
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Email</label>
              <Input value={autoFill.email} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed" />
            </div>
            {autoFill.phone_number && (
              <div className="mt-3 space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Phone Number</label>
                <Input value={autoFill.phone_number} readOnly className="h-9 bg-muted/30 text-muted-foreground cursor-not-allowed" />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">Pulled from your account.</p>
          </div>

          {loadingQ ? (
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
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    )}
                    {q.question_type === "multiple_choice" && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                              type="radio"
                              name={q.question_id}
                              value={String(oi)}
                              checked={answers[q.question_id] === String(oi)}
                              onChange={() => setAnswer(q.question_id, String(oi))}
                              required={q.is_required}
                              className="h-4 w-4 text-primary"
                            />
                            <span className="text-sm text-foreground group-hover:text-primary transition-colors">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {q.question_type === "checkbox" && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checkedIndices(q.question_id).includes(oi)}
                              onChange={() => toggleCheckbox(q.question_id, oi)}
                              className="h-4 w-4 rounded text-primary"
                            />
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
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Application"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    submitted: "Submitted", screening: "Screening",
    first_interview: "1st Interview", technical_interview: "Technical",
    final_interview: "Final Interview", hired: "Hired",
    rejected: "Rejected", withdrawn: "Withdrawn",
  };
  return map[status] ?? status;
}

function statusPillClass(status: string): string {
  if (["hired"].includes(status)) return "text-green-600 border-green-600/20 bg-green-500/10";
  if (["rejected", "withdrawn"].includes(status)) return "text-red-600 border-red-600/20 bg-red-500/10";
  if (status.includes("interview")) return "text-blue-600 border-blue-600/20 bg-blue-500/10";
  return "text-muted-foreground border-border bg-muted/30";
}

function statusDotClass(status: string): string {
  if (status === "hired") return "bg-green-500";
  if (status === "rejected" || status === "withdrawn") return "bg-red-500";
  if (status === "final_interview") return "bg-violet-500";
  if (status.includes("interview")) return "bg-blue-500";
  if (status === "screening") return "bg-amber-500";
  return "bg-primary";
}

const STAGE_LABELS = ["Submitted", "Screening", "1st Interview", "Technical", "Final"];
const STAGE_KEYS   = ["submitted", "screening", "first_interview", "technical_interview", "final_interview"];

function stageIndex(status: string) {
  const i = STAGE_KEYS.indexOf(status);
  return i === -1 ? 0 : i;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function isNewJob(postedAt: string): boolean {
  return (Date.now() - new Date(postedAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicantDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<StoredUser | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [applyingJob, setApplyingJob] = useState<JobPosting | null>(null);
  const [latestApp, setLatestApp] = useState<MyApplication | null>(null);

  useEffect(() => {
    setSession(getUserInfo());
    Promise.all([
      getApplicantJobs().catch(() => [] as JobPosting[]),
      getMyApplications().catch(() => [] as MyApplication[]),
    ]).then(([jobList, myApps]) => {
      setJobs(jobList);
      setApplications(myApps);
      setAppliedJobIds(new Set(myApps.map((a) => a.job_posting_id)));
      if (myApps.length > 0) {
        const sorted = [...myApps].sort(
          (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
        );
        setLatestApp(sorted[0]);
      }
    }).finally(() => setLoading(false));
  }, []);

  const recentApplications = useMemo(() =>
    [...applications].sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()).slice(0, 5),
    [applications]
  );
  const activeCount = applications.filter(a => !["rejected", "hired", "withdrawn"].includes(a.status)).length;
  const interviewCount = applications.filter(a => a.status.includes("interview")).length;

  useWelcomeToast(session?.name || "Applicant", "Candidate Portal");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q) ||
        (j.employment_type ?? "").toLowerCase().includes(q)
    );
  }, [jobs, search]);

  const currentStep = latestApp ? stageIndex(latestApp.status) + 1 : 0;

  const metricCards = [
    {
      label: "Open Jobs",
      value: loading ? "—" : jobs.length.toString(),
      helper: "Roles available now",
      icon: <Briefcase className="h-4 w-4" />,
      iconBg: "bg-blue-500/30 border-blue-400/30 text-blue-200",
      topBorder: "border-t-blue-400/60",
    },
    {
      label: "Applications",
      value: loading ? "—" : applications.length.toString(),
      helper: "Total submitted",
      icon: <FileText className="h-4 w-4" />,
      iconBg: "bg-indigo-500/30 border-indigo-400/30 text-indigo-200",
      topBorder: "border-t-indigo-400/60",
    },
    {
      label: "In Progress",
      value: loading ? "—" : activeCount.toString(),
      helper: "Awaiting next step",
      icon: <TrendingUp className="h-4 w-4" />,
      iconBg: "bg-amber-500/30 border-amber-400/30 text-amber-200",
      topBorder: "border-t-amber-400/60",
    },
    {
      label: "Interviews",
      value: loading ? "—" : interviewCount.toString(),
      helper: "Rounds reached",
      icon: <CalendarClock className="h-4 w-4" />,
      iconBg: "bg-purple-500/30 border-purple-400/30 text-purple-200",
      topBorder: "border-t-purple-400/60",
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] text-white shadow-lg">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-500 blur-[80px] opacity-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 h-40 w-40 rounded-full bg-teal-400 blur-[80px] opacity-20 pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 h-32 w-32 rounded-full bg-indigo-500 blur-[80px] opacity-10 pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 px-6 pt-7 pb-5 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45 mb-1.5">Candidate Dashboard</p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight">
                {getGreeting()}, <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-300 to-teal-300">{session?.name?.split(" ")[0] || "Applicant"}</span>
              </h1>
              <p className="text-sm text-white/55 mt-1.5 max-w-md">
                Track your applications and discover fresh opportunities all in one place.
              </p>
            </div>
            {!loading && applications.length > 0 && (
              <Link
                href="/applicant/applications"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/8 hover:bg-white/14 transition-colors text-[11px] font-semibold text-white/70 hover:text-white shrink-0 cursor-pointer"
              >
                My Applications <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Metric cards */}
        <div className="relative z-10 p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricCards.map((m) => (
            <div
              key={m.label}
              className={`rounded-xl border border-white/12 border-t-2 ${m.topBorder} bg-white/8 backdrop-blur-sm p-4 transition-colors hover:bg-white/12`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/55">{m.label}</p>
                <span className={`h-8 w-8 rounded-lg border flex items-center justify-center ${m.iconBg}`}>
                  {m.icon}
                </span>
              </div>
              <p className="text-4xl font-bold tracking-tight text-white">{m.value}</p>
              <p className="text-[11px] mt-1.5 text-white/50">{m.helper}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Application Stage Tracker ── */}
      <div className="rounded-2xl border border-border shadow-sm overflow-hidden bg-card">
        <div className="px-6 pt-5 pb-4 border-b border-border bg-linear-to-r from-primary/6 to-teal-500/4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Latest Application</p>
              {latestApp ? (
                <>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {latestApp.job_postings?.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {STAGE_LABELS[stageIndex(latestApp.status)] ?? latestApp.status}
                    {latestApp.job_postings?.location && ` · ${latestApp.job_postings.location}`}
                  </p>
                </>
              ) : (
                <h2 className="text-xl font-bold tracking-tight text-muted-foreground">
                  No applications yet
                </h2>
              )}
            </div>
            {latestApp && (
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-tight rounded-full border border-primary/20 self-start">
                Active Phase
              </span>
            )}
          </div>
        </div>

        <div className="px-8 py-10">
          {latestApp ? (
            <div className="relative flex items-center justify-between w-full max-w-4xl mx-auto">
              <div className="absolute left-0 top-6 -translate-y-1/2 w-full h-1.5 bg-muted rounded-full z-0" />
              <div
                className="absolute left-0 top-6 -translate-y-1/2 h-1.5 bg-linear-to-r from-primary to-teal-500 rounded-full z-0 transition-all duration-1000"
                style={{ width: `${((currentStep - 1) / (STAGE_LABELS.length - 1)) * 100}%` }}
              />
              {STAGE_LABELS.map((label, i) => (
                <StepItem
                  key={label}
                  icon={i + 1 < currentStep ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                  label={label}
                  active={i + 1 <= currentStep}
                  completed={i + 1 < currentStep}
                  current={i + 1 === currentStep}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-14 w-14 rounded-2xl bg-muted/40 border border-border flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-center text-muted-foreground text-sm">
                Start by applying to an open role, then track every stage here.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-4 border-t border-border flex justify-end">
          <Link
            href="/applicant/applications"
            className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
          >
            View all applications <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Available Positions ── */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Available Positions</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {loading ? "Loading…" : `${jobs.length} open position${jobs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search jobs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-card border-border focus-visible:ring-primary/20"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3 text-xs font-semibold shrink-0 gap-1.5"
              onClick={() => router.push("/applicant/jobs")}
            >
              Browse All <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-14 w-14 rounded-2xl bg-muted/40 border border-border flex items-center justify-center">
              <Search className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <p className="text-center text-muted-foreground text-sm">
              {jobs.length === 0 ? "No open positions available." : "No jobs match your search."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.slice(0, 6).map((job) => {
                const applied = appliedJobIds.has(job.job_posting_id);
                const isNew = isNewJob(job.posted_at);
                return (
                  <div
                    key={job.job_posting_id}
                    className="group relative bg-card border border-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-px transition-all cursor-pointer overflow-hidden"
                    onClick={() => router.push("/applicant/jobs")}
                  >
                    {/* Left accent */}
                    <div className="absolute left-0 top-0 bottom-0 w-0.75 bg-primary/0 group-hover:bg-primary/60 rounded-l-xl transition-colors duration-200" />

                    <div className="p-4 flex flex-col gap-3">
                      {/* Header row */}
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl border border-border bg-muted/30 flex items-center justify-center shrink-0 group-hover:bg-primary/8 group-hover:border-primary/20 transition-colors">
                          <Briefcase className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <h3 className="font-bold text-foreground text-sm leading-tight group-hover:text-primary transition-colors truncate">
                              {job.title}
                            </h3>
                            {isNew && (
                              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-green-500/15 text-green-600 border border-green-500/20">
                                New
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5">
                            {job.employment_type && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
                                {job.employment_type}
                              </span>
                            )}
                            {job.location && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <MapPin className="h-3 w-3" />{job.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer row */}
                      <div
                        className="flex items-center justify-between border-t border-border pt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          {job.salary_range && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                              <DollarSign className="h-3 w-3" />{job.salary_range}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground/50">
                            {timeAgo(job.posted_at)}
                          </span>
                        </div>
                        {applied ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-green-600 dark:text-green-400 border border-green-600/20 bg-green-500/10 px-2.5 py-1 rounded-lg">
                            <CheckCircle className="h-3 w-3" /> Applied
                          </span>
                        ) : (
                          <Button
                            className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-4 text-xs"
                            onClick={(e) => { e.stopPropagation(); setApplyingJob(job); }}
                          >
                            Apply <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {jobs.length > 6 && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="ghost"
                  className="text-primary font-bold hover:bg-primary/5 text-sm gap-1.5"
                  onClick={() => router.push("/applicant/jobs")}
                >
                  View all {jobs.length} positions <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Recent Applications ── */}
      <Card className="border-border shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-4 bg-linear-to-r from-primary/7 to-teal-500/4 border-b border-border/70">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Application Feed</p>
          <CardTitle className="text-lg font-bold tracking-tight">Recent Applications</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Latest submissions and their current status.
          </p>
        </CardHeader>
        <CardContent className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentApplications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-12 w-12 rounded-2xl bg-muted/40 border border-border flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground/30" />
              </div>
              <p className="text-center text-muted-foreground text-sm">No applications yet.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline connector line */}
              <div className="absolute left-2.75 top-3 bottom-3 w-px bg-border" />

              <div className="space-y-1">
                {recentApplications.map((app, idx) => (
                  <div key={app.application_id} className="relative flex items-center gap-4 pl-7 py-2.5 rounded-xl hover:bg-muted/30 transition-colors group">
                    {/* Timeline dot */}
                    <div className={`absolute left-0 h-5.5 w-5.5 rounded-full border-2 border-background flex items-center justify-center z-10 ${statusDotClass(app.status)}`}>
                      <div className="h-2 w-2 rounded-full bg-white/80" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                        {app.job_postings?.title ?? "Untitled role"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border inline-block ${statusPillClass(app.status)}`}>
                          {statusLabel(app.status)}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(app.applied_at)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-border">
                <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href="/applicant/applications">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Open Full Tracker
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application form modal */}
      {applyingJob && (
        <ApplicationForm
          job={applyingJob}
          onClose={() => setApplyingJob(null)}
          onApplied={() => {
            setAppliedJobIds((prev) => new Set([...prev, applyingJob.job_posting_id]));
            setApplyingJob(null);
            getMyApplications().catch(() => []).then((apps) => {
              if (apps.length > 0) {
                const sorted = [...apps].sort(
                  (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
                );
                setLatestApp(sorted[0]);
              }
            });
          }}
        />
      )}
    </div>
  );
}

function StepItem({ icon, label, active, completed, current }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  completed: boolean;
  current: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 relative z-10">
      <div className={`h-12 w-12 rounded-full border-2 flex items-center justify-center transition-all shadow-sm
        ${completed
          ? "bg-linear-to-br from-primary to-primary/80 border-primary text-primary-foreground shadow-primary/25"
          : current
          ? "bg-background border-primary text-primary ring-4 ring-primary/15 shadow-primary/10"
          : "bg-background border-border text-muted-foreground"
        }`}>
        {icon}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest text-center max-w-18 leading-tight
        ${active ? "text-foreground" : "text-muted-foreground/40"}`}>
        {label}
      </span>
    </div>
  );
}
