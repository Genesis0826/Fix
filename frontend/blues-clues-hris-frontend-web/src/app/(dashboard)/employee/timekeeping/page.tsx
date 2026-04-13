"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, LogIn, LogOut, MapPin,
  ChevronLeft, ChevronRight, CalendarDays, List,
  AlertTriangle, X, CheckCircle2, FileX,
  Stethoscope, Zap, Home, User, Palmtree, BadgeCheck, HelpCircle,
  Timer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authFetch, logoutApi } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { formatTime, formatHoursFromTimestamps, todayPST } from "@/lib/timekeepingUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

type MyStatus = {
  date: string;
  current_status: "time-in" | "time-out" | "absence" | null;
  time_in: { timestamp: string; latitude: number; longitude: number } | null;
  time_out: { timestamp: string; latitude: number; longitude: number } | null;
};

type AbsenceEntry = {
  timestamp: string;
  absence_reason: string | null;
  absence_notes: string | null;
};

type TimesheetEntry = {
  date: string;
  time_in: { timestamp: string; latitude: number | null; longitude: number | null } | null;
  time_out: { timestamp: string; latitude: number | null; longitude: number | null } | null;
  absence: AbsenceEntry | null;
};

// ─── Absence reason config ────────────────────────────────────────────────────

const ABSENCE_REASONS = [
  { value: "Sick Leave",          icon: Stethoscope, color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200",    activeBg: "bg-rose-600"    },
  { value: "Emergency Leave",     icon: Zap,         color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200",  activeBg: "bg-orange-600"  },
  { value: "WFH / Remote",        icon: Home,        color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200",    activeBg: "bg-blue-600"    },
  { value: "Personal Leave",      icon: User,        color: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-200",  activeBg: "bg-violet-600"  },
  { value: "Vacation Leave",      icon: Palmtree,    color: "text-teal-600",    bg: "bg-teal-50",    border: "border-teal-200",    activeBg: "bg-teal-600"    },
  { value: "On Leave (Approved)", icon: BadgeCheck,  color: "text-green-600",   bg: "bg-green-50",   border: "border-green-200",   activeBg: "bg-green-600"   },
  { value: "Other",               icon: HelpCircle,  color: "text-slate-500",   bg: "bg-slate-50",   border: "border-slate-200",   activeBg: "bg-slate-600"   },
] as const;

type AbsenceReasonValue = (typeof ABSENCE_REASONS)[number]["value"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTs(ts: string): Date {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

function formatLiveTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function formatLiveDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    timeZone: "Asia/Manila",
  });
}

function formatEntryDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatCellTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "—";
  return parseTs(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila",
  });
}

function formatCoordinates(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return "No GPS";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function calcDuration(from: string, to: Date = new Date()): string {
  const diff = to.getTime() - parseTs(from).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatLongDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

type EntryStatus = "on-time" | "late" | "in-progress" | "absent" | "excused";

function getEntryStatus(entry: TimesheetEntry): EntryStatus {
  if (!entry.time_in) {
    return entry.absence?.absence_reason ? "excused" : "absent";
  }
  if (!entry.time_out) return "in-progress";
  const hourPST = Number.parseInt(
    parseTs(entry.time_in.timestamp).toLocaleString("en-US", {
      hour: "numeric", hour12: false, timeZone: "Asia/Manila",
    }), 10
  );
  return hourPST >= 9 ? "late" : "on-time";
}

const ENTRY_STATUS_CONFIG: Record<EntryStatus, { label: string; badge: string; dot: string; cell: string }> = {
  "on-time":     { label: "On Time",     badge: "bg-green-100 hover:bg-green-100 text-green-700 border-green-200",     dot: "bg-green-500",  cell: "bg-green-50 border-green-200" },
  "late":        { label: "Late",        badge: "bg-amber-100 hover:bg-amber-100 text-amber-700 border-amber-200",     dot: "bg-amber-500",  cell: "bg-amber-50 border-amber-200" },
  "in-progress": { label: "In Progress", badge: "bg-blue-100 hover:bg-blue-100 text-blue-700 border-blue-200",         dot: "bg-blue-500",   cell: "bg-blue-50 border-blue-200" },
  "absent":      { label: "Absent",      badge: "bg-red-100 hover:bg-red-100 text-red-700 border-red-200",             dot: "bg-red-500",    cell: "bg-red-50 border-red-200" },
  "excused":     { label: "Excused",     badge: "bg-purple-100 hover:bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500", cell: "bg-purple-50 border-purple-200" },
};

function buildDateMap(entries: TimesheetEntry[]): Record<string, TimesheetEntry> {
  return Object.fromEntries(entries.map(e => [e.date, e]));
}

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const ITEMS_PER_PAGE = 7;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function executePunch(type: "time-in" | "time-out", coords: { latitude: number; longitude: number }) {
  const res = await authFetch(`${API_BASE_URL}/timekeeping/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(coords),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string })?.message || `Failed to clock ${type === "time-in" ? "in" : "out"}.`);
  }
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────

function ConfirmModal({ children, onClose }: Readonly<{ children: React.ReactNode; onClose: () => void }>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-border w-full max-w-sm mx-4 animate-in zoom-in-95 duration-150">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

// ─── Calendar Day Detail Modal ────────────────────────────────────────────────

function CalendarDayModal({
  dateStr, entry, onClose,
}: Readonly<{ dateStr: string; entry: TimesheetEntry | null; onClose: () => void }>) {
  const status = entry ? getEntryStatus(entry) : null;
  const cfg    = status ? ENTRY_STATUS_CONFIG[status] : null;
  const isFuture = dateStr > todayPST();

  const absenceReasonCfg = entry?.absence?.absence_reason
    ? ABSENCE_REASONS.find(r => r.value === entry.absence!.absence_reason)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-border w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 ${cfg ? `${cfg.cell} border-b` : "border-b border-border"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Attendance Record</p>
              <h2 className="text-base font-bold text-foreground leading-tight">{formatLongDate(dateStr)}</h2>
            </div>
            <div className="flex items-center gap-2">
              {cfg && (
                <Badge className={`text-[10px] font-bold border ${cfg.badge}`}>{cfg.label}</Badge>
              )}
              {isFuture && (
                <Badge className="text-[10px] font-bold bg-slate-100 text-slate-500 border-slate-200">Upcoming</Badge>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {isFuture ? (
            <p className="text-sm text-muted-foreground text-center py-4">No records yet — this is a future date.</p>
          ) : !entry || (!entry.time_in && !entry.absence) ? (
            <div className="flex flex-col items-center py-4 gap-2">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">No Attendance Recorded</p>
              <p className="text-xs text-muted-foreground text-center">No clock-in or absence report was found for this day.</p>
            </div>
          ) : (status === "excused" || status === "absent") && entry.absence ? (
            /* ── Absence / Excused ───────────────────────────────────────── */
            <div className="space-y-3">
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${absenceReasonCfg ? `${absenceReasonCfg.bg} ${absenceReasonCfg.border}` : "bg-purple-50 border-purple-200"}`}>
                {absenceReasonCfg && (
                  <div className={`p-2 rounded-lg bg-white/60`}>
                    <absenceReasonCfg.icon className={`h-4 w-4 ${absenceReasonCfg.color}`} />
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Absence Reason</p>
                  <p className="text-sm font-bold text-foreground">{entry.absence.absence_reason}</p>
                </div>
              </div>
              {entry.absence.absence_notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-foreground leading-relaxed">{entry.absence.absence_notes}</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Timer className="h-3.5 w-3.5" />
                <span>Reported at {formatCellTime(entry.absence.timestamp)}</span>
              </div>
            </div>
          ) : (
            /* ── Punched In ──────────────────────────────────────────────── */
            <div className="space-y-3">
              {/* Time In */}
              {entry.time_in && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <LogIn className="h-4 w-4 text-green-600" />
                    <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Clock In</p>
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums">{formatCellTime(entry.time_in.timestamp)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {formatCoordinates(entry.time_in.latitude, entry.time_in.longitude)}
                  </p>
                </div>
              )}

              {/* Time Out */}
              {entry.time_out ? (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <LogOut className="h-4 w-4 text-red-500" />
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Clock Out</p>
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums">{formatCellTime(entry.time_out.timestamp)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {formatCoordinates(entry.time_out.latitude, entry.time_out.longitude)}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-sm font-semibold text-blue-700">Shift still in progress</p>
                </div>
              )}

              {/* Hours worked */}
              {entry.time_in && entry.time_out && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-muted-foreground">Total Hours Worked</p>
                  <p className="text-sm font-bold">{formatHoursFromTimestamps(entry.time_in.timestamp, entry.time_out.timestamp)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Absence Modal ────────────────────────────────────────────────────────────

function AbsenceModal({
  visible, now, absenceReason, absenceNotes, absenceLoading, absenceError,
  onReasonChange, onNotesChange, onSubmit, onClose,
}: Readonly<{
  visible: boolean;
  now: Date;
  absenceReason: AbsenceReasonValue;
  absenceNotes: string;
  absenceLoading: boolean;
  absenceError: string | null;
  onReasonChange: (r: AbsenceReasonValue) => void;
  onNotesChange: (n: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}>) {
  if (!visible) return null;

  const selectedCfg = ABSENCE_REASONS.find(r => r.value === absenceReason)!;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md mx-0 sm:mx-4 bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 overflow-hidden">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-5 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Report Absence</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Manila" })}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] sm:max-h-none overflow-y-auto">
          {/* Reason selection */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
              Select Reason <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ABSENCE_REASONS.map(({ value, icon: Icon, color, bg, border, activeBg }) => {
                const isActive = absenceReason === value;
                return (
                  <button
                    key={value}
                    onClick={() => onReasonChange(value)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                      isActive
                        ? `${activeBg} border-transparent text-white`
                        : `${bg} ${border} hover:border-slate-300`
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : color}`} />
                    <span className={`text-xs font-bold leading-tight ${isActive ? "text-white" : "text-foreground"}`}>
                      {value}
                    </span>
                    {isActive && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-white ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected summary chip */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${selectedCfg.bg} ${selectedCfg.border} border`}>
            <selectedCfg.icon className={`h-3.5 w-3.5 ${selectedCfg.color}`} />
            <p className="text-xs font-semibold text-foreground">
              Reporting: <span className={`font-bold ${selectedCfg.color}`}>{absenceReason}</span>
            </p>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Notes</p>
              <p className="text-[10px] text-muted-foreground">{absenceNotes.length}/500</p>
            </div>
            <textarea
              value={absenceNotes}
              onChange={e => onNotesChange(e.target.value.slice(0, 500))}
              placeholder="Add any context for your HR team (optional)..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 resize-none transition-colors"
            />
          </div>

          {/* Error */}
          {absenceError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{absenceError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 flex gap-3 border-t border-slate-100">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose} disabled={absenceLoading}>
            Cancel
          </Button>
          <Button
            className="flex-1 cursor-pointer font-bold"
            style={{ backgroundColor: selectedCfg.activeBg.replace("bg-", "") }}
            onClick={onSubmit}
            disabled={absenceLoading}
          >
            {absenceLoading ? "Submitting..." : "Submit Absence"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeTimekeepingPage() {
  const router = useRouter();

  const [now, setNow]                       = useState(new Date());
  const [status, setStatus]                 = useState<MyStatus | null>(null);
  const [timesheet, setTimesheet]           = useState<TimesheetEntry[]>([]);
  const [statusLoading, setStatusLoading]   = useState(true);
  const [sheetLoading, setSheetLoading]     = useState(true);
  const [fetchError, setFetchError]         = useState(false);
  const [actionLoading, setActionLoading]   = useState(false);
  const [actionError, setActionError]       = useState<string | null>(null);
  const [location, setLocation]             = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError]   = useState<string | null>(null);

  // Modal state
  const [modal, setModal] = useState<null | "time-in" | "time-out" | "absence">(null);

  // Absence form
  const [absenceReason, setAbsenceReason]     = useState<AbsenceReasonValue>(ABSENCE_REASONS[0].value);
  const [absenceNotes, setAbsenceNotes]       = useState("");
  const [absenceLoading, setAbsenceLoading]   = useState(false);
  const [absenceError, setAbsenceError]       = useState<string | null>(null);
  const [absenceSuccess, setAbsenceSuccess]   = useState(false);

  // Calendar
  const [view, setView]           = useState<"calendar" | "list">("calendar");
  const [calMonth, setCalMonth]   = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [page, setPage]           = useState(1);
  const [calDayModal, setCalDayModal] = useState<{ dateStr: string; entry: TimesheetEntry | null } | null>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setLocationError("Location access denied. Please allow location to clock in or out.")
    );
  }, []);

  // Fetch status + timesheet
  useEffect(() => {
    authFetch(`${API_BASE_URL}/timekeeping/my-status`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<MyStatus>; })
      .then(setStatus)
      .catch(() => setFetchError(true))
      .finally(() => setStatusLoading(false));

    authFetch(`${API_BASE_URL}/timekeeping/my-timesheet`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<TimesheetEntry[]>; })
      .then(setTimesheet)
      .catch(() => setFetchError(true))
      .finally(() => setSheetLoading(false));
  }, []);

  async function refreshData() {
    const [s, t] = await Promise.all([
      authFetch(`${API_BASE_URL}/timekeeping/my-status`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/timekeeping/my-timesheet`).then(r => r.json()),
    ]);
    setStatus(s);
    setTimesheet(t);
  }

  async function handleConfirmPunch(type: "time-in" | "time-out", signOut = false) {
    if (!location) {
      setActionError(locationError || "Location not available. Please allow location access.");
      setModal(null);
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await executePunch(type, location);
      setModal(null);
      if (signOut) {
        await logoutApi();
        router.push("/login");
        return;
      }
      await refreshData();
    } catch (err: unknown) {
      setActionError((err as { message?: string })?.message || "Something went wrong.");
      setModal(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAbsenceSubmit() {
    setAbsenceLoading(true);
    setAbsenceError(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/timekeeping/report-absence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: absenceReason, notes: absenceNotes || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string })?.message || "Failed to report absence.");
      }
      setAbsenceSuccess(true);
      setModal(null);
      setAbsenceNotes("");
      await refreshData();
    } catch (err: unknown) {
      setAbsenceError((err as { message?: string })?.message || "Something went wrong.");
    } finally {
      setAbsenceLoading(false);
    }
  }

  // Derived — absence blocks time-in/out at both UI and API level
  const hasReportedAbsence = status?.current_status === "absence";
  const canTimeIn  = !status?.time_in && !hasReportedAbsence;
  const canTimeOut = status?.current_status === "time-in";
  const shiftDone  = !!(status?.time_in && status?.time_out);
  const todayAbsence = timesheet.find(e => e.date === todayPST())?.absence ?? null;

  const dateMap  = useMemo(() => buildDateMap(timesheet), [timesheet]);
  const calGrid  = useMemo(() => buildCalendarGrid(calMonth.year, calMonth.month), [calMonth]);
  const calTitle = new Date(calMonth.year, calMonth.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today    = todayPST();

  function prevMonth() {
    setCalMonth(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
  }
  function nextMonth() {
    const n = new Date();
    if (calMonth.year === n.getFullYear() && calMonth.month === n.getMonth()) return;
    setCalMonth(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });
  }

  const totalPages = Math.ceil(timesheet.length / ITEMS_PER_PAGE);
  const paged      = timesheet.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const isCurrentMonth = (() => {
    const n = new Date();
    return calMonth.year === n.getFullYear() && calMonth.month === n.getMonth();
  })();

  // ── Calendar view ─────────────────────────────────────────────────────────

  const calendarView = (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-bold text-sm">{calTitle}</p>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth} disabled={isCurrentMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {calGrid.map((day, idx) => {
          if (!day) return <div key={`empty-${calMonth.year}-${calMonth.month}-${idx}`} />;

          const dateStr     = toDateStr(calMonth.year, calMonth.month, day);
          const entry       = dateMap[dateStr];
          const isToday     = dateStr === today;
          const isFuture    = dateStr > today;
          const entryStatus = entry ? getEntryStatus(entry) : null;
          const cfg         = entryStatus ? ENTRY_STATUS_CONFIG[entryStatus] : null;
          const isAbsent    = entryStatus === "absent" || entryStatus === "excused";
          const isClickable = !isFuture;

          let cellClass = "bg-background border-border hover:border-primary/30";
          if (isToday)       cellClass = "bg-primary/10 border-primary shadow-md";
          else if (isFuture) cellClass = "bg-background border-border opacity-40 cursor-default";
          else if (cfg)      cellClass = `${cfg.cell} border hover:opacity-90`;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isFuture}
              onClick={() => isClickable && setCalDayModal({ dateStr, entry: entry ?? null })}
              className={`relative rounded-xl border p-2 min-h-[5.5rem] flex flex-col transition-all text-left w-full ${cellClass} ${isClickable ? "cursor-pointer" : ""}`}
            >
              <div className={`text-sm font-bold mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>{day}</div>

              {/* Absence indicator */}
              {!isFuture && isAbsent && entry?.absence && (
                <div className="flex-1 mt-0.5 space-y-0.5">
                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold border ${
                    entryStatus === "excused"
                      ? "bg-purple-100 text-purple-700 border-purple-200"
                      : "bg-red-100 text-red-700 border-red-200"
                  }`}>
                    <FileX className="h-2.5 w-2.5 shrink-0" />
                    {entryStatus === "excused" ? "Excused" : "Absent"}
                  </div>
                  {entry.absence.absence_reason && (
                    <p className="text-[8px] font-semibold text-muted-foreground truncate leading-tight px-0.5">
                      {entry.absence.absence_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Punch times */}
              {!isFuture && entry?.time_in && (
                <div className="flex-1 space-y-0.5 text-[8px] leading-tight">
                  <div className="flex items-center gap-0.5 font-semibold text-foreground">
                    <LogIn className="h-2.5 w-2.5 shrink-0 text-green-600" />
                    {formatCellTime(entry.time_in.timestamp)}
                  </div>
                  {entry.time_out && (
                    <div className="flex items-center gap-0.5 font-semibold text-foreground">
                      <LogOut className="h-2.5 w-2.5 shrink-0 text-red-500" />
                      {formatCellTime(entry.time_out.timestamp)}
                    </div>
                  )}
                </div>
              )}

              {/* Status dot */}
              {!isToday && !isFuture && cfg && (
                <div className="mt-auto pt-1">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                </div>
              )}

              {/* Click hint */}
              {isClickable && (
                <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100">
                  <div className="h-1 w-1 rounded-full bg-current opacity-30" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-5 flex-wrap">
        {Object.entries(ENTRY_STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            <span className="text-[10px] text-muted-foreground font-medium">{cfg.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">Tap any past date to see details</p>
    </div>
  );

  // ── List view ─────────────────────────────────────────────────────────────

  const listView = (
    <>
      <div className="divide-y divide-border">
        {timesheet.length === 0 ? (
          <p className="px-6 py-10 text-center text-muted-foreground text-sm">No attendance records found.</p>
        ) : paged.map(entry => {
          const entryStatus = getEntryStatus(entry);
          const cfg = ENTRY_STATUS_CONFIG[entryStatus];
          return (
            <button
              key={entry.date}
              type="button"
              onClick={() => setCalDayModal({ dateStr: entry.date, entry })}
              className="w-full text-left px-6 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className="font-semibold text-sm">{formatEntryDate(entry.date)}</span>
                </div>
                <Badge className={`text-[9px] font-bold border ${cfg.badge}`}>{cfg.label}</Badge>
              </div>
              {entry.time_in && (
                <div className="flex items-center gap-6 mt-2 ml-5 text-xs text-muted-foreground">
                  <span>In: <span className="font-semibold text-foreground">{formatTime(entry.time_in.timestamp)}</span></span>
                  {entry.time_out && <span>Out: <span className="font-semibold text-foreground">{formatTime(entry.time_out.timestamp)}</span></span>}
                  {entry.time_out && <span>Hours: <span className="font-semibold text-foreground">{formatHoursFromTimestamps(entry.time_in.timestamp, entry.time_out.timestamp)}</span></span>}
                </div>
              )}
              {!entry.time_in && entry.absence?.absence_reason && (
                <div className="mt-2 ml-5 flex items-center gap-2">
                  <FileX className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  <span className="text-xs text-purple-700 font-medium">{entry.absence.absence_reason}</span>
                  {entry.absence.absence_notes && (
                    <span className="text-xs text-muted-foreground truncate">— {entry.absence.absence_notes}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 bg-muted/10 border-t border-border flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {timesheet.length > 0
            ? `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, timesheet.length)} of ${timesheet.length}`
            : "No records"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setPage(p => p - 1)} disabled={page === 1 || totalPages === 0}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setPage(p => p + 1)} disabled={page === totalPages || totalPages === 0}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Calendar Day Modal ──────────────────────────────────────────────── */}
      {calDayModal && (
        <CalendarDayModal
          dateStr={calDayModal.dateStr}
          entry={calDayModal.entry}
          onClose={() => setCalDayModal(null)}
        />
      )}

      {/* ── Absence Modal ───────────────────────────────────────────────────── */}
      <AbsenceModal
        visible={modal === "absence"}
        now={now}
        absenceReason={absenceReason}
        absenceNotes={absenceNotes}
        absenceLoading={absenceLoading}
        absenceError={absenceError}
        onReasonChange={setAbsenceReason}
        onNotesChange={setAbsenceNotes}
        onSubmit={handleAbsenceSubmit}
        onClose={() => { setModal(null); setAbsenceError(null); }}
      />

      {/* ── Time In Confirmation ────────────────────────────────────────────── */}
      {modal === "time-in" && (
        <ConfirmModal onClose={() => setModal(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-green-100">
                <LogIn className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <h2 className="font-bold text-base">Confirm Clock In</h2>
                <p className="text-xs text-muted-foreground">Your attendance will be recorded</p>
              </div>
            </div>
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Time</span>
                <span className="font-semibold tabular-nums">{formatLiveTime(now)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-xs">
                  {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "Not available"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 cursor-pointer" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                onClick={() => handleConfirmPunch("time-in")}
                disabled={actionLoading}
              >
                {actionLoading ? "Clocking In..." : "Clock In"}
              </Button>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* ── Time Out Confirmation ───────────────────────────────────────────── */}
      {modal === "time-out" && (
        <ConfirmModal onClose={() => setModal(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-orange-100">
                <LogOut className="h-5 w-5 text-orange-700" />
              </div>
              <div>
                <h2 className="font-bold text-base">Confirm Clock Out</h2>
                <p className="text-xs text-muted-foreground">Your shift will be closed</p>
              </div>
            </div>
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Time</span>
                <span className="font-semibold tabular-nums">{formatLiveTime(now)}</span>
              </div>
              {status?.time_in && (
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-semibold">{calcDuration(status.time_in.timestamp, now)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-xs">
                  {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "Not available"}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 cursor-pointer" onClick={() => setModal(null)}>Cancel</Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
                  onClick={() => handleConfirmPunch("time-out", false)}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Clocking Out..." : "Clock Out"}
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full text-slate-600 hover:text-red-600 hover:border-red-300 cursor-pointer gap-2"
                onClick={() => handleConfirmPunch("time-out", true)}
                disabled={actionLoading}
              >
                <LogOut className="h-4 w-4" />
                Clock Out &amp; Sign Out
              </Button>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* ── Clock In/Out Card ───────────────────────────────────────────────── */}
      <Card className="border-0 overflow-hidden shadow-lg text-white bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)]">
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-white/70 mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Current Time
              </p>
              <p className="text-5xl font-bold tracking-tight tabular-nums">{formatLiveTime(now)}</p>
              <p className="text-sm text-white/70 mt-1">{formatLiveDate(now)}</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                {location ? (
                  <span className="text-white/90">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
                ) : (
                  <span className="text-white/50">{locationError ?? "Acquiring location..."}</span>
                )}
              </div>

              {hasReportedAbsence ? (
                <div className="flex items-center gap-2 rounded-lg bg-purple-500/20 border border-purple-400/30 px-4 py-3 text-sm font-semibold text-purple-100">
                  <FileX className="h-4 w-4 shrink-0" />
                  Absence reported — clock-in disabled for today.
                </div>
              ) : shiftDone ? (
                <div className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-sm font-semibold text-white/90">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  Shift complete — attendance recorded for today.
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    onClick={() => { setActionError(null); setModal("time-in"); }}
                    disabled={!canTimeIn || actionLoading}
                    className="bg-white text-slate-900 hover:bg-white/90 font-bold gap-2 flex-1 cursor-pointer"
                  >
                    <LogIn className="h-4 w-4" /> Time In
                  </Button>
                  <Button
                    onClick={() => { setActionError(null); setModal("time-out"); }}
                    disabled={!canTimeOut || actionLoading}
                    className="bg-white/10 border border-white/40 text-white hover:bg-white/20 font-bold gap-2 flex-1 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" /> Time Out
                  </Button>
                </div>
              )}

              {actionError && (
                <p className="text-sm text-red-300 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {actionError}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Report Absence ──────────────────────────────────────────────────── */}
      {!statusLoading && canTimeIn && !shiftDone && !hasReportedAbsence && (
        <div className="rounded-xl border px-5 py-4 flex items-center justify-between gap-4 bg-slate-50 border-slate-200 transition-colors">
          <div className="flex items-center gap-3">
            <FileX className="h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-semibold text-slate-700">Not clocking in today?</p>
              <p className="text-xs text-muted-foreground">Let your HR team know by reporting your absence.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-slate-300 text-slate-600 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 cursor-pointer"
            onClick={() => { setAbsenceError(null); setModal("absence"); }}
          >
            Report Absence
          </Button>
        </div>
      )}

      {/* Absence reported confirmation banner */}
      {!statusLoading && (hasReportedAbsence || todayAbsence) && (
        <div className="rounded-xl border px-5 py-4 bg-purple-50 border-purple-200">
          <div className="flex items-center gap-3">
            {(() => {
              const reason = todayAbsence?.absence_reason ?? "";
              const cfg = ABSENCE_REASONS.find(r => r.value === reason);
              if (!cfg) return <FileX className="h-5 w-5 shrink-0 text-purple-500" />;
              const Icon = cfg.icon;
              return (
                <div className={`p-1.5 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                </div>
              );
            })()}
            <div>
              <p className="text-sm font-semibold text-purple-800">Absence reported for today</p>
              <p className="text-xs text-purple-600">
                {todayAbsence?.absence_reason}
                {todayAbsence?.absence_notes ? ` — ${todayAbsence.absence_notes}` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Today's punch summary ───────────────────────────────────────────── */}
      {!statusLoading && !fetchError && status && !hasReportedAbsence && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Time In",  value: formatTime(status.time_in?.timestamp) },
            { label: "Time Out", value: formatTime(status.time_out?.timestamp) },
            { label: "Hours",    value: formatHoursFromTimestamps(status.time_in?.timestamp, status.time_out?.timestamp) },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
              <p className="text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Attendance History ──────────────────────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="p-6 bg-muted/20 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Attendance History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your monthly and daily time records</p>
          </div>
          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
        </div>

        {sheetLoading ? (
          <p className="px-6 py-10 text-center text-muted-foreground text-sm">Loading records...</p>
        ) : fetchError ? (
          <p className="px-6 py-10 text-center text-destructive text-sm">Failed to load records. Please refresh or contact support.</p>
        ) : (
          view === "calendar" ? calendarView : listView
        )}
      </Card>
    </div>
  );
}
