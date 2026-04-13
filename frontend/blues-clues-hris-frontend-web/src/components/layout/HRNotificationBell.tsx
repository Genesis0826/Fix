"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, X, Check, Loader2, CheckCircle2, XCircle, CalendarClock, ChevronRight,
  UserCheck, FilePen,
} from "lucide-react";
import { getHRInterviewNotifications, type HRInterviewNotification } from "@/lib/authApi";
import { getUserInfo } from "@/lib/authStorage";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "@/lib/notificationsApi";

const HR_NOTIF_TYPES = new Set(['ONBOARDING_SUBMITTED', 'PROFILE_CHANGE_SUBMITTED']);

// ─── Config ───────────────────────────────────────────────────────────────────

const RESPONSE_CONFIG = {
  accepted: {
    label:      "Accepted",
    badgeClass: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/40",
    iconClass:  "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    Icon:       CheckCircle2,
  },
  declined: {
    label:      "Declined",
    badgeClass: "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700/30",
    iconClass:  "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    Icon:       XCircle,
  },
  reschedule_requested: {
    label:      "Reschedule Requested",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/30",
    iconClass:  "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    Icon:       CalendarClock,
  },
} as const;

// ─── localStorage helpers ─────────────────────────────────────────────────────

function storageKey(email: string) {
  return `hr_notif_read_v1_${email}`;
}

function loadReadIds(email: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(email));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistReadIds(email: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(email), JSON.stringify([...ids]));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── HRNotificationBell ───────────────────────────────────────────────────────

export function HRNotificationBell() {
  const router = useRouter();
  const [open, setOpen]               = useState(false);
  const [items, setItems]             = useState<HRInterviewNotification[]>([]);
  const [dbNotifs, setDbNotifs]       = useState<AppNotification[]>([]);
  const [readIds, setReadIdsState]    = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const dropdownRef                   = useRef<HTMLDivElement>(null);
  const btnRef                        = useRef<HTMLButtonElement>(null);

  const userEmail = getUserInfo()?.email ?? "";

  // Fetch both sources on mount
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      getHRInterviewNotifications(),
      getMyNotifications(),
    ])
      .then(([interviews, allNotifs]) => {
        if (!alive) return;
        setItems(interviews);
        setReadIdsState(loadReadIds(userEmail));
        setDbNotifs(allNotifs.filter((n) => HR_NOTIF_TYPES.has(n.type)));
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userEmail]);

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

  const interviewUnread = items.filter((n) => !readIds.has(n.schedule_id)).length;
  const dbUnread = dbNotifs.filter((n) => !n.is_read).length;
  const unreadCount = interviewUnread + dbUnread;

  const markAllRead = useCallback(async () => {
    const next = new Set([...readIds, ...items.map((n) => n.schedule_id)]);
    setReadIdsState(next);
    persistReadIds(userEmail, next);
    if (dbUnread > 0) {
      await markAllNotificationsRead();
      setDbNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  }, [items, readIds, userEmail, dbUnread]);

  const markOneRead = useCallback(
    (id: string) => {
      if (readIds.has(id)) return;
      const next = new Set(readIds);
      next.add(id);
      setReadIdsState(next);
      persistReadIds(userEmail, next);
    },
    [readIds, userEmail],
  );

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center border-2 border-background leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {unreadCount === 0 && !loading && items.length === 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-muted-foreground/30 rounded-full border-2 border-background" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-96 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
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
                  ? `${unreadCount} new response${unreadCount > 1 ? "s" : ""}`
                  : "All caught up"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && !loading && (
                <button
                  onClick={markAllRead}
                  className="h-7 px-2 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Check className="h-3 w-3" /> All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="h-7 w-7 rounded-lg hover:bg-muted/60 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="h-px bg-border mx-4" />

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 && dbNotifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 px-4">
                <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-semibold text-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground text-center">
                  Interview responses and onboarding submissions will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {/* Interview responses */}
                {items.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-muted/20">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Interview Responses</p>
                    </div>
                    {items.map((notif) => {
                      const isRead = readIds.has(notif.schedule_id);
                      const cfg    = RESPONSE_CONFIG[notif.applicant_response];
                      const { Icon } = cfg;
                      const name   = [notif.first_name, notif.last_name].filter(Boolean).join(" ") || notif.email;
                      return (
                        <button
                          key={notif.schedule_id}
                          onClick={() => {
                            markOneRead(notif.schedule_id);
                            setOpen(false);
                            router.push(`/hr/jobs?application=${notif.application_id}`);
                          }}
                          className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer group ${
                            isRead
                              ? "opacity-60 hover:opacity-80 hover:bg-muted/20"
                              : "hover:bg-primary/5"
                          }`}
                        >
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isRead ? "bg-muted/40 text-muted-foreground" : cfg.iconClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground leading-tight truncate">{name}</p>
                              <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${isRead ? "bg-muted/40 text-muted-foreground border-border" : cfg.badgeClass}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{notif.job_title}</p>
                            {notif.applicant_response_note && (
                              <p className="text-xs text-foreground/70 mt-1 line-clamp-2 italic">"{notif.applicant_response_note}"</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium uppercase tracking-wide">
                              Scheduled {notif.scheduled_date} · {timeAgo(notif.applicant_responded_at)}
                            </p>
                          </div>
                          {!isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2 group-hover:scale-110 transition-transform" />}
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Onboarding & Profile Change notifications */}
                {dbNotifs.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-muted/20">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Onboarding &amp; Profile</p>
                    </div>
                    {dbNotifs.map((notif) => {
                      const isOnboarding = notif.type === 'ONBOARDING_SUBMITTED';
                      const Icon = isOnboarding ? UserCheck : FilePen;
                      const iconClass = isOnboarding
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400";
                      return (
                        <button
                          key={notif.notification_id}
                          onClick={async () => {
                            if (!notif.is_read) {
                              await markNotificationRead(notif.notification_id);
                              setDbNotifs((prev) => prev.map((n) =>
                                n.notification_id === notif.notification_id ? { ...n, is_read: true } : n,
                              ));
                            }
                            setOpen(false);
                            router.push('/hr/onboarding');
                          }}
                          className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer group ${
                            notif.is_read ? "opacity-60 hover:opacity-80 hover:bg-muted/20" : "hover:bg-primary/5"
                          }`}
                        >
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${notif.is_read ? "bg-muted/40 text-muted-foreground" : iconClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-tight truncate">{notif.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium uppercase tracking-wide">
                              {timeAgo(notif.created_at)}
                            </p>
                          </div>
                          {!notif.is_read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2 group-hover:scale-110 transition-transform" />}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-px bg-border" />
          <div className="px-4 py-3">
            <button
              onClick={() => { setOpen(false); router.push("/hr/jobs"); }}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              Go to Recruitment
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
