"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, FileText, MapPin, Briefcase, CheckCircle2, X, Calendar,
  ChevronRight, ClipboardList, Clock, Trophy, Mic, Cpu,
  Search, Filter, SortAsc, SortDesc, TrendingUp, CheckCheck, XCircle,
  RotateCcw, DollarSign, AlarmClock, Video, Phone, Building2, Link2,
  User, MessageSquare, AlertCircle, ThumbsUp, ThumbsDown, CalendarClock,
} from "lucide-react";
import {
  getMyApplications, getMyApplicationDetail, respondToInterview,
  type MyApplication, type ApplicationDetail, type InterviewSchedule, type InterviewAction,
} from "@/lib/authApi";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  { key: "submitted",           label: "Applied",       short: "Applied",  icon: FileText    },
  { key: "screening",           label: "Screening",     short: "Screen",   icon: Search      },
  { key: "first_interview",     label: "1st Interview", short: "1st Int.", icon: Mic         },
  { key: "technical_interview", label: "Technical",     short: "Tech",     icon: Cpu         },
  { key: "final_interview",     label: "Final",         short: "Final",    icon: Trophy      },
] as const;

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string; darkBadge: string }> = {
  submitted:           { label: "Applied",             badge: "bg-blue-100 text-blue-700 border-blue-200",      dot: "bg-blue-500",   darkBadge: "bg-blue-500/20 text-blue-200 border-blue-400/30"    },
  screening:           { label: "Screening",           badge: "bg-amber-100 text-amber-700 border-amber-200",   dot: "bg-amber-500",  darkBadge: "bg-amber-500/20 text-amber-200 border-amber-400/30"  },
  first_interview:     { label: "1st Interview",       badge: "bg-purple-100 text-purple-700 border-purple-200",dot: "bg-purple-500", darkBadge: "bg-purple-500/20 text-purple-200 border-purple-400/30"},
  technical_interview: { label: "Technical Interview", badge: "bg-indigo-100 text-indigo-700 border-indigo-200",dot: "bg-indigo-500", darkBadge: "bg-indigo-500/20 text-indigo-200 border-indigo-400/30"},
  final_interview:     { label: "Final Interview",     badge: "bg-violet-100 text-violet-700 border-violet-200",dot: "bg-violet-500", darkBadge: "bg-violet-500/20 text-violet-200 border-violet-400/30"},
  hired:               { label: "Hired",               badge: "bg-green-100 text-green-700 border-green-200",   dot: "bg-green-500",  darkBadge: "bg-green-500/20 text-green-200 border-green-400/30"  },
  rejected:            { label: "Not Selected",        badge: "bg-red-100 text-red-700 border-red-200",         dot: "bg-red-500",    darkBadge: "bg-red-500/20 text-red-200 border-red-400/30"        },
};

type SortKey = "date_desc" | "date_asc" | "status";
type FilterStatus = "all" | "active" | "hired" | "rejected";

function isTerminal(s: string) { return s === "hired" || s === "rejected"; }
function isActive(s: string)   { return !isTerminal(s); }
function fmtDate(iso: string)  {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── Stage Progress ───────────────────────────────────────────────────────────

function StageProgress({ status }: { readonly status: string }) {
  const terminal     = isTerminal(status);
  const currentIdx   = STAGES.findIndex((s) => s.key === status);
  const effectiveIdx = terminal ? STAGES.length : currentIdx;

  let terminalNodeBg = "bg-muted/30 border-border";
  if (terminal) {
    terminalNodeBg = status === "hired" ? "bg-green-500 border-green-500 shadow-sm shadow-green-500/20" : "bg-red-400 border-red-400";
  }
  let terminalTextColor = "text-muted-foreground/35";
  if (terminal) {
    terminalTextColor = status === "hired" ? "text-green-600" : "text-red-500";
  }
  let terminalLabel = "Result";
  if (status === "hired") terminalLabel = "Hired";
  else if (status === "rejected") terminalLabel = "Out";

  return (
    <div className="flex items-start gap-0 mt-3">
      {STAGES.map((stage, i) => {
        const done    = i < effectiveIdx;
        const current = i === currentIdx && !terminal;
        const Icon    = stage.icon;
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all
                ${done    ? "bg-primary border-primary shadow-sm shadow-primary/20"           : ""}
                ${current ? "bg-background border-primary ring-[3px] ring-primary/15 shadow-sm" : ""}
                ${!done && !current ? "bg-muted/30 border-border"                            : ""}
              `}>
                {done    && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                {current && <Icon className="h-3 w-3 text-primary" />}
                {!done && !current && <Icon className="h-3 w-3 text-muted-foreground/30" />}
              </div>
              <span className={`mt-1 text-[9px] font-bold uppercase tracking-[0.06em] text-center leading-tight max-w-11
                ${done || current ? "text-foreground" : "text-muted-foreground/35"}
              `}>{stage.short}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-0.5 flex-1 -mt-4 mx-0.5 rounded-full ${i < effectiveIdx - 1 ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
      {/* Terminal node */}
      <div className="flex items-center flex-1 min-w-0">
        <div className={`h-0.5 flex-1 -mt-4 mx-0.5 rounded-full ${terminal ? "bg-primary" : "bg-border"}`} />
        <div className="flex flex-col items-center shrink-0">
          <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all ${terminalNodeBg}`}>
            {terminal ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : <Trophy className="h-3 w-3 text-muted-foreground/30" />}
          </div>
          <span className={`mt-1 text-[9px] font-bold uppercase tracking-[0.06em] text-center leading-tight max-w-11 ${terminalTextColor}`}>{terminalLabel}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Application Card ─────────────────────────────────────────────────────────

function ApplicationCard({ app, onView }: { readonly app: MyApplication; readonly onView: (id: string) => void }) {
  const cfg      = STATUS_CONFIG[app.status] ?? STATUS_CONFIG["submitted"];
  const terminal = isTerminal(app.status);

  let cardBorderClass = "border-border";
  if (app.status === "hired") cardBorderClass = "border-green-200 dark:border-green-800/50";
  else if (app.status === "rejected") cardBorderClass = "border-red-200/60 dark:border-red-800/30";

  let statusBarClass = cfg.dot;
  if (app.status === "hired") statusBarClass = "bg-linear-to-r from-green-400 to-emerald-500";
  else if (app.status === "rejected") statusBarClass = "bg-linear-to-r from-red-400 to-rose-500";

  let iconContainerClass = "bg-primary/10 text-primary border border-primary/15";
  if (app.status === "hired") iconContainerClass = "bg-green-500/10 text-green-600 border border-green-200/60 dark:border-green-700/40";
  else if (app.status === "rejected") iconContainerClass = "bg-red-500/10 text-red-500 border border-red-200/60 dark:border-red-700/40";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onView(app.application_id)}
      onKeyDown={(e) => e.key === "Enter" && onView(app.application_id)}
      className={`bg-card border rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${cardBorderClass}`}
    >
      {/* Status color bar — thicker + gradient for hired/rejected */}
      <div className={`h-1.5 w-full ${statusBarClass}`} />

      <div className="p-5 space-y-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconContainerClass}`}>
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground text-base leading-tight truncate">{app.job_postings?.title ?? "—"}</p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1">
                {app.job_postings?.location && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />{app.job_postings.location}
                  </span>
                )}
                {app.job_postings?.employment_type && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />{app.job_postings.employment_type}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>

        {/* Date + time ago */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Applied {fmtDate(app.applied_at)}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground/70">{timeAgo(app.applied_at)}</span>
        </div>

        {/* Progress or terminal banner */}
        {terminal ? (
          <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold ${
            app.status === "hired"
              ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700/40 dark:text-green-300"
              : "bg-red-50/60 border-red-200/70 text-red-600 dark:bg-red-900/10 dark:border-red-700/30 dark:text-red-400"
          }`}>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {app.status === "hired" ? "Congratulations! You've been hired." : "This application was not selected."}
          </div>
        ) : (
          <StageProgress status={app.status} />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-muted-foreground font-medium">{cfg.label}</span>
          </div>
          <Button
            size="sm" variant="ghost"
            className="h-8 px-3 gap-1.5 text-xs font-semibold text-muted-foreground border border-transparent hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onView(app.application_id); }}
          >
            View Details <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

type DetailWithJob = ApplicationDetail & {
  job_postings?: {
    title: string;
    description: string | null;
    location: string | null;
    employment_type: string | null;
    salary_range: string | null;
    status: string;
    posted_at: string;
    closes_at: string | null;
  };
};

const FORMAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  in_person: Building2,
  video:     Video,
  phone:     Phone,
};
const FORMAT_LABELS: Record<string, string> = {
  in_person: "In-Person",
  video:     "Video Call",
  phone:     "Phone Call",
};

const INTERVIEW_STAGES = new Set(["first_interview", "technical_interview", "final_interview"]);

type ActionMode = "accept" | "decline" | "reschedule" | null;

const ACTION_CONFIG = {
  accept:     { label: "Accept",              icon: ThumbsUp,      color: "text-green-600",  bg: "bg-green-50 border-green-200",  btnClass: "bg-green-600 hover:bg-green-700 text-white",  placeholder: "Confirm you will attend and share any notes for HR…" },
  decline:    { label: "Decline",             icon: ThumbsDown,    color: "text-red-600",    bg: "bg-red-50 border-red-200",      btnClass: "bg-red-600 hover:bg-red-700 text-white",      placeholder: "Explain why you are unable to attend this interview…" },
  reschedule: { label: "Request Reschedule",  icon: CalendarClock, color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",  btnClass: "bg-amber-600 hover:bg-amber-700 text-white",  placeholder: "Explain why you need to reschedule and provide your preferred dates/times…" },
} as const;

const RESPONSE_DISPLAY: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; banner: string; dot: string }> = {
  accepted:             { label: "You accepted this interview",             icon: CheckCircle2,  banner: "bg-green-50 border-green-200 text-green-700",  dot: "bg-green-500"  },
  declined:             { label: "You declined this interview",             icon: ThumbsDown,    banner: "bg-red-50 border-red-200 text-red-700",        dot: "bg-red-500"    },
  reschedule_requested: { label: "Reschedule requested — awaiting HR reply", icon: CalendarClock, banner: "bg-amber-50 border-amber-200 text-amber-700",  dot: "bg-amber-500"  },
};

function InterviewTab({
  schedule,
  status,
  applicationId,
  onResponded,
}: {
  readonly schedule: InterviewSchedule | null | undefined;
  readonly status: string;
  readonly applicationId: string;
  readonly onResponded: (updated: Partial<InterviewSchedule>) => void;
}) {
  const isInterviewStage = INTERVIEW_STAGES.has(status);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [reason, setReason]         = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isInterviewStage) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground gap-3">
        <Calendar className="h-8 w-8 opacity-20" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">No interview yet</p>
          <p className="text-xs mt-1">Interview details will appear here once you reach an interview stage.</p>
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="flex flex-col items-center py-12 gap-3">
        <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-amber-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Schedule pending</p>
          <p className="text-xs text-muted-foreground mt-1">HR is preparing your interview schedule. Check back soon or watch for an email.</p>
        </div>
      </div>
    );
  }

  const FormatIcon  = FORMAT_ICONS[schedule.format] ?? Calendar;
  const formatLabel = FORMAT_LABELS[schedule.format] ?? schedule.format;

  const dateStr = schedule.scheduled_date
    ? new Date(`${schedule.scheduled_date}T${schedule.scheduled_time ?? "00:00"}`).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : "—";
  const timeStr = schedule.scheduled_time
    ? new Date(`2000-01-01T${schedule.scheduled_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "—";

  const existingResponse = schedule.applicant_response ?? null;
  const responseDisplay  = existingResponse ? RESPONSE_DISPLAY[existingResponse] : null;

  // Detect if HR rescheduled: updated_at is significantly later than created_at
  const wasRescheduledByHR =
    !existingResponse &&
    !!schedule.updated_at &&
    !!schedule.created_at &&
    new Date(schedule.updated_at).getTime() - new Date(schedule.created_at).getTime() > 30_000;

  async function handleSubmit() {
    if (!actionMode) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("Reason is required.");
      return;
    }
    const actionMap: Record<ActionMode & string, InterviewAction> = {
      accept:     "accepted",
      decline:    "declined",
      reschedule: "reschedule_requested",
    };
    setSubmitting(true);
    try {
      await respondToInterview(applicationId, actionMap[actionMode], trimmed, schedule?.stage ?? undefined);
      toast.success(`Response submitted — ${ACTION_CONFIG[actionMode].label.toLowerCase()}.`);
      onResponded({
        applicant_response:      actionMap[actionMode],
        applicant_response_note: trimmed,
        applicant_responded_at:  new Date().toISOString(),
      });
      setActionMode(null);
      setReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit response.");
    } finally {
      setSubmitting(false);
    }
  }

  const cfg = actionMode ? ACTION_CONFIG[actionMode] : null;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* ── Response banner (if already responded) ── */}
      {responseDisplay && (
        <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${responseDisplay.banner}`}>
          <responseDisplay.icon className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{responseDisplay.label}</p>
            {schedule.applicant_response_note && (
              <p className="text-xs mt-1 opacity-80 leading-relaxed">&ldquo;{schedule.applicant_response_note}&rdquo;</p>
            )}
            {schedule.applicant_responded_at && (
              <p className="text-[10px] font-bold uppercase tracking-wide mt-1.5 opacity-60">
                Responded {fmtDate(schedule.applicant_responded_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Rescheduled by HR banner ── */}
      {wasRescheduledByHR && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <RotateCcw className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-700 leading-snug">HR has updated your interview schedule</p>
            <p className="text-xs text-amber-600 mt-0.5">Please review the new details below and submit your response.</p>
          </div>
        </div>
      )}

      {/* ── Date & Time banner ── */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Scheduled</p>
          <p className="text-sm font-bold text-foreground leading-tight">{dateStr}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />{timeStr} · {schedule.duration_minutes} min
          </p>
        </div>
      </div>

      {/* ── Format ── */}
      <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
          <FormatIcon className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Format</p>
          <p className="text-sm font-semibold text-foreground">{formatLabel}</p>
        </div>
      </div>

      {/* ── Location / Meeting link ── */}
      {(schedule.location || schedule.meeting_link) && (
        <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {schedule.meeting_link ? "Meeting Link" : "Location"}
            </p>
            {schedule.meeting_link ? (
              <a href={schedule.meeting_link} target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold text-primary hover:underline truncate block">
                {schedule.meeting_link}
              </a>
            ) : (
              <p className="text-sm font-semibold text-foreground truncate">{schedule.location}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Interviewer ── */}
      <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Interviewer</p>
          <p className="text-sm font-semibold text-foreground">{schedule.interviewer_name}</p>
          {schedule.interviewer_title && (
            <p className="text-xs text-muted-foreground">{schedule.interviewer_title}</p>
          )}
        </div>
      </div>

      {/* ── Notes from HR ── */}
      {schedule.notes && (
        <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 mt-0.5">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1">Notes from HR</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{schedule.notes}</p>
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      {!existingResponse && !actionMode && (
        <div className="pt-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">Your Response</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setActionMode("accept")}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-green-200 bg-green-50 px-3 py-3 hover:bg-green-100 hover:border-green-300 transition-all duration-150 cursor-pointer group"
            >
              <div className="h-8 w-8 rounded-full bg-green-100 group-hover:bg-green-200 border border-green-300 flex items-center justify-center transition-colors">
                <ThumbsUp className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-[11px] font-bold text-green-700">Accept</span>
            </button>
            <button
              onClick={() => setActionMode("decline")}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-3 hover:bg-red-100 hover:border-red-300 transition-all duration-150 cursor-pointer group"
            >
              <div className="h-8 w-8 rounded-full bg-red-100 group-hover:bg-red-200 border border-red-300 flex items-center justify-center transition-colors">
                <ThumbsDown className="h-4 w-4 text-red-600" />
              </div>
              <span className="text-[11px] font-bold text-red-700">Decline</span>
            </button>
            <button
              onClick={() => setActionMode("reschedule")}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-3 hover:bg-amber-100 hover:border-amber-300 transition-all duration-150 cursor-pointer group"
            >
              <div className="h-8 w-8 rounded-full bg-amber-100 group-hover:bg-amber-200 border border-amber-300 flex items-center justify-center transition-colors">
                <CalendarClock className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-[11px] font-bold text-amber-700">Reschedule</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Reason form ── */}
      {actionMode && cfg && (
        <div className={`rounded-xl border-2 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200 ${cfg.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
              <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
            </div>
            <button
              onClick={() => { setActionMode(null); setReason(""); }}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-black/10 transition-colors cursor-pointer"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1">
              Reason
              <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={cfg.placeholder}
              rows={3}
              className="resize-none text-sm bg-white/80 border-border focus-visible:ring-primary/20"
            />
            <p className="text-[10px] text-muted-foreground">Required — this will be sent to the HR team.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !reason.trim()}
              className={`h-9 px-4 text-xs font-semibold flex-1 ${cfg.btnClass}`}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {submitting ? "Submitting…" : `Submit ${cfg.label}`}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setActionMode(null); setReason(""); }}
              disabled={submitting}
              className="h-9 px-4 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Change response (already responded) ── */}
      {existingResponse && (
        <button
          onClick={() => { setActionMode(null); setReason(""); }}
          className="w-full text-xs text-muted-foreground hover:text-primary transition-colors text-center cursor-pointer py-1 underline underline-offset-2"
        >
          Need to change your response? Contact HR directly.
        </button>
      )}
    </div>
  );
}

function DetailModal({ detail, onClose, initialTab }: { readonly detail: DetailWithJob; readonly onClose: () => void; readonly initialTab?: "job" | "answers" | "interview" }) {
  const [tab, setTab] = useState<"job" | "answers" | "interview">(initialTab ?? "job");
  // Prefer the schedule for the current application status (stage), fall back to latest
  const [schedule, setSchedule] = useState<InterviewSchedule | null | undefined>(
    detail.interview_schedules?.[detail.status] ?? detail.interview_schedule
  );
  const cfg    = STATUS_CONFIG[detail.status] ?? STATUS_CONFIG["submitted"];
  const job    = detail.job_postings;
  const sorted = [...detail.answers].sort((a, b) => a.application_questions.sort_order - b.application_questions.sort_order);

  // Re-fetch the latest schedule when the user switches to the interview tab
  const fetchSchedule = useCallback(async () => {
    try {
      const fresh = await getMyApplicationDetail(detail.application_id);
      const freshSchedule = fresh.interview_schedules?.[detail.status] ?? fresh.interview_schedule ?? null;
      setSchedule(freshSchedule ?? null);
    } catch {
      // silently ignore — stale data is still better than an error
    }
  }, [detail.application_id, detail.status]);

  useEffect(() => {
    if (tab === "interview") {
      fetchSchedule();
    }
  }, [tab, fetchSchedule]);

  function handleResponded(updated: Partial<InterviewSchedule>) {
    setSchedule((prev) => prev ? { ...prev, ...updated } : prev);
  }

  return (
    <div role="presentation" className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 animate-in fade-in duration-200 p-4" onClick={onClose} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div role="dialog" aria-modal="true" className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>

        {/* Gradient header */}
        <div className="relative overflow-hidden rounded-t-2xl bg-[linear-gradient(135deg,#0f172a_0%,#172554_55%,#134e4a_100%)] px-6 pt-5 pb-0">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-blue-500 blur-3xl opacity-15 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />

          <div className="relative flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                <Briefcase className="h-5 w-5 text-white/70" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">Job Posting</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${cfg.darkBadge}`}>
                    {cfg.label}
                  </span>
                </div>
                <h2 className="text-[15px] font-bold text-white leading-snug">{job?.title ?? "Job Application"}</h2>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {job?.location && (
                    <span className="flex items-center gap-1 text-[11px] text-white/50">
                      <MapPin className="h-3 w-3" />{job.location}
                    </span>
                  )}
                  {job?.employment_type && (
                    <span className="flex items-center gap-1 text-[11px] text-white/50">
                      <Clock className="h-3 w-3" />{job.employment_type}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-white/50">
                    <Calendar className="h-3 w-3" />Applied {fmtDate(detail.applied_at)}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors border border-white/10 shrink-0 mt-0.5 cursor-pointer">
              <X className="h-3.5 w-3.5 text-white/60" />
            </button>
          </div>

        </div>

        {/* ── Tab bar — white, always visible ── */}
        <div className="flex items-center border-b border-border bg-card shrink-0 px-2">
          <button
            onClick={() => setTab("job")}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer -mb-px ${
              tab === "job"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            Job Details
          </button>
          <button
            onClick={() => setTab("interview")}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer -mb-px ${
              tab === "interview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Interview
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
              tab === "interview"
                ? (schedule?.applicant_response === "accepted" ? "bg-green-100 text-green-700 border-green-200"
                  : schedule?.applicant_response === "declined" ? "bg-red-100 text-red-700 border-red-200"
                  : schedule?.applicant_response === "reschedule_requested" ? "bg-amber-100 text-amber-700 border-amber-200"
                  : schedule ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-muted text-muted-foreground border-border")
                : (schedule?.applicant_response === "accepted" ? "bg-green-100 text-green-700 border-green-200"
                  : schedule?.applicant_response === "declined" ? "bg-red-100 text-red-700 border-red-200"
                  : schedule?.applicant_response === "reschedule_requested" ? "bg-amber-100 text-amber-700 border-amber-200"
                  : schedule ? "bg-blue-100 text-blue-700 border-blue-200"
                  : "bg-muted text-muted-foreground border-border")
            }`}>
              {schedule?.applicant_response === "accepted" ? "Accepted"
                : schedule?.applicant_response === "declined" ? "Declined"
                : schedule?.applicant_response === "reschedule_requested" ? "Reschedule"
                : schedule ? "Scheduled"
                : INTERVIEW_STAGES.has(detail.status) ? "Pending"
                : "—"}
            </span>
          </button>
          <button
            onClick={() => setTab("answers")}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer -mb-px ${
              tab === "answers"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            My Answers
            {sorted.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                tab === "answers" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"
              }`}>
                {sorted.length}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* ── JOB DETAILS TAB ── */}
          {tab === "job" && (
            <>
              <div className="flex flex-wrap gap-2">
                {job?.salary_range && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold shadow-sm dark:bg-green-900/20 dark:border-green-700/40 dark:text-green-300">
                    <DollarSign className="h-3.5 w-3.5" />{job.salary_range}
                  </span>
                )}
                {job?.employment_type && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-sm dark:bg-blue-900/20 dark:border-blue-700/40 dark:text-blue-300">
                    <Clock className="h-3.5 w-3.5" />{job.employment_type}
                  </span>
                )}
                {job?.location && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-semibold shadow-sm">
                    <MapPin className="h-3.5 w-3.5" />{job.location}
                  </span>
                )}
                {job?.closes_at && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold shadow-sm dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-300">
                    <AlarmClock className="h-3.5 w-3.5" />Closes {fmtDate(job.closes_at)}
                  </span>
                )}
              </div>

              {job?.description ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">Job Description</p>
                  <div className="rounded-xl border border-border bg-muted/20 px-4 py-4 shadow-inner">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{job.description}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-muted-foreground gap-2">
                  <FileText className="h-7 w-7 opacity-20" />
                  <p className="text-xs">No description available for this posting.</p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">Your Application Status</p>
                <div className="rounded-xl border border-border bg-muted/20 px-4 py-4">
                  <div className="mb-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <StageProgress status={detail.status} />
                  {isTerminal(detail.status) && (
                    <div className={`mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold ${
                      detail.status === "hired"
                        ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700/40 dark:text-green-300"
                        : "bg-red-50/60 border-red-200/70 text-red-600 dark:bg-red-900/10 dark:border-red-700/30 dark:text-red-400"
                    }`}>
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {detail.status === "hired" ? "Congratulations! You've been hired." : "This application was not selected."}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── INTERVIEW TAB ── */}
          {tab === "interview" && (
            <InterviewTab
              schedule={schedule}
              status={detail.status}
              applicationId={detail.application_id}
              onResponded={handleResponded}
            />
          )}

          {/* ── MY ANSWERS TAB ── */}
          {tab === "answers" && (
            sorted.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">These are the answers you submitted with your application.</p>
                {sorted.map((ans, i) => (
                  <div key={ans.answer_id} className="rounded-xl border border-border bg-muted/15 overflow-hidden">
                    <div className="flex items-start gap-2.5 px-4 pt-3 pb-2.5">
                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <p className="text-xs font-semibold text-foreground leading-snug">{ans.application_questions.question_text}</p>
                    </div>
                    <div className="h-px bg-border mx-4" />
                    <div className="px-4 pb-3 pt-2.5 pl-11">
                      <p className="text-sm text-foreground leading-relaxed">
                        {ans.answer_value || <span className="text-muted-foreground italic text-xs">No answer provided</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-muted-foreground gap-3">
                <ClipboardList className="h-8 w-8 opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">No questions were required</p>
                  <p className="text-xs mt-1">This job posting had no application form questions.</p>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicantApplicationsPage() {
  const searchParams = useSearchParams();
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading]             = useState(true);
  const [detail, setDetail]               = useState<ApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [openInitialTab, setOpenInitialTab] = useState<"job" | "answers" | "interview" | undefined>(undefined);
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState<FilterStatus>("all");
  const [sort, setSort]                   = useState<SortKey>("date_desc");

  useEffect(() => {
    getMyApplications()
      .then(setApplications)
      .catch((err: any) => toast.error(err.message || "Failed to load applications"))
      .finally(() => setLoading(false));
  }, []);

  const handleViewDetails = useCallback(async (appId: string, tab?: "job" | "answers" | "interview") => {
    setDetailLoading(true);
    setOpenInitialTab(tab);
    try {
      const d = await getMyApplicationDetail(appId);
      setDetail(d);
    } catch (err: any) {
      toast.error(err.message || "Failed to load application details");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Auto-open application from ?open= query param (e.g., from notification bell)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && !detail && !loading) {
      handleViewDetails(openId, "interview");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total    = applications.length;
  const active   = applications.filter((a) => isActive(a.status)).length;
  const hired    = applications.filter((a) => a.status === "hired").length;
  const rejected = applications.filter((a) => a.status === "rejected").length;
  const inInterview = applications.filter((a) =>
    ["first_interview", "technical_interview", "final_interview"].includes(a.status)
  ).length;

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...applications];

    if (filterStatus === "active")   list = list.filter((a) => isActive(a.status));
    if (filterStatus === "hired")    list = list.filter((a) => a.status === "hired");
    if (filterStatus === "rejected") list = list.filter((a) => a.status === "rejected");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        (a.job_postings?.title ?? "").toLowerCase().includes(q) ||
        (a.job_postings?.location ?? "").toLowerCase().includes(q)
      );
    }

    if (sort === "date_desc") list.sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime());
    if (sort === "date_asc")  list.sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime());
    if (sort === "status") {
      const order = ["submitted","screening","first_interview","technical_interview","final_interview","hired","rejected"];
      list.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    }

    return list;
  }, [applications, filterStatus, search, sort]);

  const filterTabs: { key: FilterStatus; label: string; count: number; icon: any }[] = [
    { key: "all",      label: "All",        count: total,     icon: FileText    },
    { key: "active",   label: "Active",     count: active,    icon: TrendingUp  },
    { key: "hired",    label: "Hired",      count: hired,     icon: CheckCheck  },
    { key: "rejected", label: "Not Selected", count: rejected, icon: XCircle    },
  ];

  function renderContent() {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-primary/40" />
        </div>
      );
    }
    if (total === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-muted-foreground">
          <div className="relative">
            <div className="h-20 w-20 rounded-3xl bg-linear-to-br from-primary/10 to-muted/30 border border-border flex items-center justify-center">
              <FileText className="h-9 w-9 opacity-25" />
            </div>
            <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-primary/50" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-bold text-foreground">No applications yet</p>
            <p className="text-sm text-muted-foreground max-w-60">Browse open positions and submit your first application to get started.</p>
          </div>
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Search className="h-8 w-8 opacity-20" />
          <p className="text-sm font-medium text-foreground">No results found</p>
          <p className="text-xs">Try adjusting your search or filter.</p>
        </div>
      );
    }
    return (
      <>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Showing {filtered.length} of {total} application{total === 1 ? "" : "s"}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((app) => (
            <ApplicationCard key={app.application_id} app={app} onView={handleViewDetails} />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">

      {/* ── Hero ── */}
      <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 md:px-7 md:py-7 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-blue-500 blur-[80px] opacity-20 pointer-events-none" />
        <div className="absolute -bottom-8 left-16 h-32 w-32 rounded-full bg-teal-500 blur-[80px] opacity-20 pointer-events-none" />
        <div className="absolute top-1/2 right-1/3 h-28 w-28 rounded-full bg-indigo-400 blur-[80px] opacity-10 pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50 mb-1.5">Candidate Portal</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white/70" />
              </div>
              My Applications
            </h1>
            <p className="text-sm text-white/55 mt-1.5">Track your progress across all roles you&apos;ve applied to</p>
          </div>
          {/* Stat chips */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-center min-w-15">
              <p className="text-xl font-bold text-white leading-none">{total}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">Total</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-center min-w-15">
              <p className="text-xl font-bold text-white leading-none">{active}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">Active</p>
            </div>
            {inInterview > 0 && (
              <div className="bg-purple-500/20 border border-purple-400/30 rounded-xl px-4 py-2.5 text-center min-w-15">
                <p className="text-xl font-bold text-purple-200 leading-none">{inInterview}</p>
                <p className="text-[10px] text-purple-300/70 uppercase tracking-widest mt-0.5">Interview</p>
              </div>
            )}
            {hired > 0 && (
              <div className="bg-green-500/20 border border-green-400/30 rounded-xl px-4 py-2.5 text-center min-w-15">
                <p className="text-xl font-bold text-green-300 leading-none">{hired}</p>
                <p className="text-[10px] text-green-400/70 uppercase tracking-widest mt-0.5">Hired</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Applied",     value: total,       sub: "total submitted",      dotColor: "bg-blue-500",   borderColor: "border-l-blue-400"   },
            { label: "In Progress", value: active,      sub: "awaiting response",    dotColor: "bg-primary",    borderColor: "border-l-primary"    },
            { label: "Interviews",  value: inInterview, sub: "rounds scheduled",     dotColor: "bg-purple-500", borderColor: "border-l-purple-400" },
            { label: "Hired",       value: hired,       sub: "offers received",      dotColor: "bg-green-500",  borderColor: "border-l-green-400"  },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border border-l-4 ${s.borderColor} border-border bg-card px-4 py-3.5 shadow-sm`}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`h-2 w-2 rounded-full shrink-0 ${s.dotColor}`} />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
              </div>
              <p className="text-2xl font-bold tracking-tight text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters + search ── */}
      {!loading && total > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterTabs.map((f) => {
              const Icon = f.icon;
              const isActive = filterStatus === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {f.label}
                  <span className={`text-[10px] font-bold min-w-4.5 px-1.5 py-0.5 rounded-full text-center ${
                    isActive ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by job title or location…"
                className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-card text-sm shadow-xs focus:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded hover:bg-muted/60 cursor-pointer">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg p-0.5">
              {([
                { key: "date_desc", icon: SortDesc, label: "Newest" },
                { key: "date_asc",  icon: SortAsc,  label: "Oldest" },
                { key: "status",    icon: Filter,   label: "Stage"  },
              ] as { key: SortKey; icon: any; label: string }[]).map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSort(s.key)}
                    title={s.label}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      sort === s.key
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {s.label}
                  </button>
                );
              })}
            </div>

            {(search || filterStatus !== "all" || sort !== "date_desc") && (
              <button
                onClick={() => { setSearch(""); setFilterStatus("all"); setSort("date_desc"); }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {renderContent()}

      {/* Loading overlay */}
      {detailLoading && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading details…</p>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && !detailLoading && (
        <DetailModal detail={detail} onClose={() => { setDetail(null); setOpenInitialTab(undefined); }} initialTab={openInitialTab} />
      )}
    </div>
  );
}
