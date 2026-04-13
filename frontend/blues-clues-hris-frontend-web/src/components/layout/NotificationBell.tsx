"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Calendar, ChevronRight, X, Check, Loader2,
  Mic, Cpu, Trophy, RotateCcw,
} from "lucide-react";
import { getMyInterviewSchedules, type MyInterviewSchedule } from "@/lib/authApi";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  first_interview:     "1st Interview Scheduled",
  technical_interview: "Technical Interview Scheduled",
  final_interview:     "Final Interview Scheduled",
};

const STAGE_DETAIL: Record<string, string> = {
  first_interview:     "HR Screening · Initial profiling stage",
  technical_interview: "Technical Assessment · Skills evaluation",
  final_interview:     "Cultural Fit · Final hiring decision stage",
};

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  first_interview:     Mic,
  technical_interview: Cpu,
  final_interview:     Trophy,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── NotificationBell ─────────────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen]                   = useState(false);
  const [schedules, setSchedules]         = useState<MyInterviewSchedule[]>([]);
  const [loading, setLoading]             = useState(true);
  const dropdownRef                       = useRef<HTMLDivElement>(null);
  const btnRef                            = useRef<HTMLButtonElement>(null);

  // Fetch interview schedules on mount
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getMyInterviewSchedules()
      .then((data) => { if (alive) setSchedules(data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // "Unread" = schedule has no applicant response yet (pending action required)
  const unreadCount = schedules.filter((s) => s.applicant_response === null).length;

  const handleViewApplication = useCallback((schedule: MyInterviewSchedule) => {
    setOpen(false);
    router.push(`/applicant/applications?open=${schedule.application_id}`);
  }, [router]);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} pending)` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center border-2 border-background leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Notifications
              </p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {loading
                  ? "Loading…"
                  : unreadCount > 0
                  ? `${unreadCount} pending response${unreadCount > 1 ? "s" : ""}`
                  : "All caught up"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
              className="h-7 w-7 rounded-lg hover:bg-muted/60 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="h-px bg-border mx-4" />

          {/* Body */}
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 px-4">
                <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-semibold text-foreground">No notifications</p>
                <p className="text-xs text-muted-foreground text-center">
                  Interview invites will appear here once your application advances.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {schedules.map((sched) => {
                  const isPending  = sched.applicant_response === null;
                  const stage      = sched.stage ?? "first_interview";
                  const StageIcon  = STAGE_ICONS[stage] ?? Calendar;
                  const respondedAt = sched.applicant_responded_at ?? sched.created_at ?? "";

                  return (
                    <button
                      key={sched.schedule_id ?? sched.application_id}
                      onClick={() => handleViewApplication(sched)}
                      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer group ${
                        isPending
                          ? "hover:bg-primary/5"
                          : "opacity-60 hover:opacity-80 hover:bg-muted/20"
                      }`}
                    >
                      {/* Stage icon */}
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isPending
                            ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        {sched.applicant_response === "reschedule_requested"
                          ? <RotateCcw className="h-4 w-4" />
                          : <StageIcon className="h-4 w-4" />
                        }
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">
                          {isPending
                            ? STAGE_LABELS[stage] ?? "Interview Update"
                            : sched.applicant_response === "accepted"
                            ? "Interview Accepted"
                            : sched.applicant_response === "declined"
                            ? "Interview Declined"
                            : "Reschedule Requested"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {sched.job_title}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium uppercase tracking-wide">
                          {isPending
                            ? `${STAGE_DETAIL[stage] ?? "Interview stage"} · Response needed`
                            : `${STAGE_DETAIL[stage] ?? ""} · ${timeAgo(respondedAt)}`}
                        </p>
                      </div>

                      {/* Pending dot */}
                      {isPending && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2 group-hover:scale-110 transition-transform" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-px bg-border" />
          <div className="px-4 py-3">
            <button
              onClick={() => { setOpen(false); router.push("/applicant/applications"); }}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              View all applications
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
