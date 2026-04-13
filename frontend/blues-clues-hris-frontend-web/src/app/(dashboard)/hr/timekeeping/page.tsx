"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Clock, Search, ChevronLeft, ChevronRight, X,
  Users, TrendingUp, Timer, BarChart2, MapPin, MapPinOff,
  FileX, CalendarDays, Download, AlertTriangle, Star,
  LogIn, LogOut, CheckCircle2, Shield,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRow = {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
};

type PunchRow = {
  log_id: string;
  employee_id: string;
  log_type: "time-in" | "time-out" | "absence";
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  ip_address: string | null;
  is_mock_location: string;
  log_status: string;
  absence_reason: string | null;
  absence_notes: string | null;
};

type RosterEntry = {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  status: "present" | "late" | "clocked-in" | "absent" | "excused";
  gps_verified: boolean;
  absence_reason: string | null;
};

type PeriodEntry = {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  days_present: number;
  days_late: number;
  days_absent: number;
  total_hours: number;
  overtime_hours: number;
  compliance_rate: number;
  flagged: boolean;
  flag_reason: string | null;
};

type DetailPunch = {
  log_id: string;
  log_type: "time-in" | "time-out" | "absence";
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  clock_type: string | null;
  log_status: string;
};

type EmployeeDetail = {
  first_name: string;
  last_name: string;
  employee_id: string;
  date: string;
  schedule: { 
    start_time: string; 
    end_time: string; 
    workdays: string[] | string; 
    is_nightshift: boolean;
  } | null;
  punches: DetailPunch[];
};

type ViewMode = "day" | "week" | "month" | "custom";
type StatusFilter = RosterEntry["status"] | "all";
type TabMode = "today" | "schedule" | "attendance";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseTs(ts: string): Date {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

function toDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
    timeZone: "Asia/Manila",
  });
}

function isToday(date: Date): boolean {
  return toDateString(date) === toDateString(new Date());
}

function formatTime(timestamp: string | null): string {
  if (!timestamp) return "—";
  return parseTs(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila",
  });
}

function formatHoursLabel(timeIn: string | null, timeOut: string | null): string {
  if (!timeIn || !timeOut) return "—";
  const diff = (parseTs(timeOut).getTime() - parseTs(timeIn).getTime()) / 3600000;
  return `${diff.toFixed(2)}h`;
}

function computeHoursDecimal(timeIn: string | null, timeOut: string | null): number | null {
  if (!timeIn || !timeOut) return null;
  return (parseTs(timeOut).getTime() - parseTs(timeIn).getTime()) / 3600000;
}

function isLate(timeIn: string): boolean {
  const h = Number.parseInt(
    parseTs(timeIn).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Manila" }), 10
  );
  return h >= 9;
}

function getWeekRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const dow = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const from = toDateString(mon);
  const to = toDateString(sun); // Include full week including future days
  return { from, to, label: `Week of ${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` };
}

function getMonthRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  // Get last day of current month
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to, label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
}

function getWorkDays(from: string, to: string): string[] {
  const days: string[] = [];
  const cur = new Date(from + "T00:00:00");
  const end = new Date(to + "T23:59:59");
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) days.push(toDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ─── Roster builders ──────────────────────────────────────────────────────────

function buildFullRoster(users: UserRow[], punches: PunchRow[]): RosterEntry[] {
  const map: Record<string, { ci: PunchRow | null; co: PunchRow | null; ab: PunchRow | null }> = {};
  for (const p of punches) {
    if (!map[p.employee_id]) map[p.employee_id] = { ci: null, co: null, ab: null };
    if (p.log_type === "time-in"  && !map[p.employee_id].ci) map[p.employee_id].ci = p;
    if (p.log_type === "time-out") map[p.employee_id].co = p;
    if (p.log_type === "absence")  map[p.employee_id].ab = p;
  }

  return users.map(u => {
    const e = map[u.employee_id];
    const ci = e?.ci ?? null;
    const co = e?.co ?? null;
    const ab = e?.ab ?? null;
    const time_in  = ci?.timestamp ?? null;
    const time_out = co?.timestamp ?? null;
    const gps_verified = !!(ci?.latitude && ci?.longitude);

    let status: RosterEntry["status"] = "absent";
    if (time_in && time_out)     status = isLate(time_in) ? "late" : "present";
    else if (time_in)            status = "clocked-in";
    else if (ab?.absence_reason) status = "excused";

    return {
      user_id: u.user_id, employee_id: u.employee_id,
      first_name: u.first_name, last_name: u.last_name,
      time_in, time_out, hours_worked: computeHoursDecimal(time_in, time_out),
      status, gps_verified, absence_reason: ab?.absence_reason ?? null,
    };
  });
}

function buildPeriodRoster(users: UserRow[], punches: PunchRow[], from: string, to: string): PeriodEntry[] {
  type DayData = { ci: string | null; co: string | null; late: boolean };
  const empMap: Record<string, Record<string, DayData>> = {};

  for (const p of punches) {
    const d = p.timestamp.split("T")[0];
    if (!empMap[p.employee_id])    empMap[p.employee_id] = {};
    if (!empMap[p.employee_id][d]) empMap[p.employee_id][d] = { ci: null, co: null, late: false };

    if (p.log_type === "time-in" && !empMap[p.employee_id][d].ci) {
      empMap[p.employee_id][d].ci   = p.timestamp;
      empMap[p.employee_id][d].late = isLate(p.timestamp);
    }
    if (p.log_type === "time-out") empMap[p.employee_id][d].co = p.timestamp;
  }

  const workDays = getWorkDays(from, to);

  return users.map(u => {
    const dayMap = empMap[u.employee_id] ?? {};
    let total_hours = 0, overtime_hours = 0, days_present = 0, days_late = 0;

    for (const day of workDays) {
      const d = dayMap[day];
      if (d?.ci && d?.co) {
        const h = computeHoursDecimal(d.ci, d.co) ?? 0;
        total_hours   += h;
        days_present++;
        if (d.late)  days_late++;
        if (h > 8)   overtime_hours += h - 8;
      }
    }

    const days_absent     = workDays.length - days_present;
    const compliance_rate = workDays.length > 0 ? (days_present / workDays.length) * 100 : 0;
    const flagged         = days_absent > 3 || days_late > 2;
    const flag_reason     = flagged
      ? [days_absent > 3 && `${days_absent} absences`, days_late > 2 && `${days_late} late`].filter(Boolean).join(", ")
      : null;

    return {
      user_id: u.user_id, employee_id: u.employee_id,
      first_name: u.first_name, last_name: u.last_name,
      days_present, days_late, days_absent,
      total_hours, overtime_hours, compliance_rate, flagged, flag_reason,
    };
  });
}

function computeStats(roster: RosterEntry[]) {
  const total   = roster.length;
  const present = roster.filter(r => r.status === "present" || r.status === "clocked-in").length;
  const late    = roster.filter(r => r.status === "late").length;
  const absent  = roster.filter(r => r.status === "absent" || r.status === "excused").length;
  const totalHours = roster.reduce((s, r) => s + (r.hours_worked ?? 0), 0);
  const avgHours   = present > 0 ? totalHours / present : 0;
  const attendance_rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  return { total, present, late, absent, totalHours, avgHours, attendance_rate };
}

function computePeriodStats(entries: PeriodEntry[]) {
  const total      = entries.length;
  const totalHours = entries.reduce((s, e) => s + e.total_hours, 0);
  const totalOt    = entries.reduce((s, e) => s + e.overtime_hours, 0);
  const avgHours   = total > 0 ? totalHours / total : 0;
  const avgCompliance = total > 0 ? entries.reduce((s, e) => s + e.compliance_rate, 0) / total : 0;
  const flaggedCount  = entries.filter(e => e.flagged).length;
  return { total, totalHours, totalOt, avgHours, avgCompliance, flaggedCount };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function downloadCSV(entries: RosterEntry[] | PeriodEntry[], isDayView: boolean, label: string) {
  let csv: string;
  if (isDayView) {
    const rows = entries as RosterEntry[];
    const header = ["Employee", "Employee ID", "Status", "Time In", "Time Out", "Hours", "GPS Verified", "Absence Reason"];
    const data   = rows.map(r => [
      `${r.first_name} ${r.last_name}`, r.employee_id, r.status,
      formatTime(r.time_in), formatTime(r.time_out),
      r.hours_worked ? `${r.hours_worked.toFixed(2)}h` : "—",
      r.gps_verified ? "Yes" : "No",
      r.absence_reason ?? "—",
    ]);
    csv = [header, ...data].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  } else {
    const rows = entries as PeriodEntry[];
    const header = ["Employee", "Employee ID", "Days Present", "Days Absent", "Days Late", "Total Hours", "Overtime Hours", "Compliance %", "Flagged"];
    const data   = rows.map(r => [
      `${r.first_name} ${r.last_name}`, r.employee_id,
      String(r.days_present), String(r.days_absent), String(r.days_late),
      `${r.total_hours.toFixed(2)}h`, `${r.overtime_hours.toFixed(2)}h`,
      `${r.compliance_rate.toFixed(1)}%`, r.flagged ? "Yes" : "No",
    ]);
    csv = [header, ...data].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url, download: `timekeeping-${label.replace(/[\s/]/g, "-")}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RosterEntry["status"], { label: string; className: string }> = {
  "present":    { label: "Present",    className: "bg-green-100 text-green-700 border border-green-200" },
  "late":       { label: "Late",       className: "bg-amber-100 text-amber-700 border border-amber-200" },
  "clocked-in": { label: "Clocked In", className: "bg-blue-100 text-blue-700 border border-blue-200" },
  "absent":     { label: "Absent",     className: "bg-red-100 text-red-700 border border-red-200" },
  "excused":    { label: "Excused",    className: "bg-purple-100 text-purple-700 border border-purple-200" },
};

function StatusBadge({ status }: Readonly<{ status: RosterEntry["status"] }>) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function FlagBadge({ reason }: Readonly<{ reason: string | null }>) {
  if (!reason) return null;
  return (
    <span title={`Risk flag: ${reason}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-600 text-[9px] font-bold uppercase tracking-wide">
      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
      Flag
    </span>
  );
}

function CompliancePill({ rate }: Readonly<{ rate: number }>) {
  const color = rate >= 90 ? "bg-green-100 text-green-700" : rate >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${color}`}>
      {rate.toFixed(0)}%
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, colorClass }: Readonly<{
  icon: any; label: string; value: string; sub: string; colorClass: string;
}>) {
  return (
    <Card className="p-5 border-border">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClass}`}><Icon className="h-4 w-4" /></div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}

// ─── Top Performers Bar ───────────────────────────────────────────────────────

function TopPerformersBar({ entries }: Readonly<{ entries: PeriodEntry[] }>) {
  const top3 = [...entries]
    .filter(e => e.days_present > 0)
    .sort((a, b) => b.compliance_rate - a.compliance_rate)
    .slice(0, 3);

  if (top3.length === 0) return null;

  const medals = ["🥇", "🥈", "🥉"];
  const medalColors = [
    "bg-amber-50 border-amber-200 text-amber-800",
    "bg-slate-50 border-slate-200 text-slate-700",
    "bg-orange-50 border-orange-200 text-orange-700",
  ];

  return (
    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 rounded-xl mb-4">
      <div className="flex items-center gap-1.5 shrink-0">
        <Star className="h-4 w-4 text-amber-500" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Top Attendance</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {top3.map((e, i) => (
          <span key={e.employee_id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${medalColors[i]}`}>
            <span>{medals[i]}</span>
            <span>{e.first_name} {e.last_name}</span>
            <span className="opacity-70 font-medium">· {e.compliance_rate.toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Employee Slide-Over — Updated with new tabs ──────────────────────────────

type SliderDay = {
  date: string;
  ci: string | null;
  co: string | null;
  hours: number | null;
  absent: boolean;
  absenceReason: string | null;
  isWeekend: boolean;
  isFuture: boolean;
  isLate: boolean;
  isOutsideRange?: boolean; // For days from adjacent months
  isScheduledWorkday?: boolean; // For non-working days per employee schedule
};

function buildSliderDays(
  punches: PunchRow[],
  employeeId: string,
  from: string,
  to: string
): SliderDay[] {
  const emp = punches.filter((p) => p.employee_id === employeeId);
  const today = toDateString(new Date());
  const result: SliderDay[] = [];
  
  // Start from the Monday of the week containing 'from'
  const startDate = new Date(from + "T12:00:00");
  const startDow = startDate.getDay();
  const firstMonday = new Date(startDate);
  firstMonday.setDate(startDate.getDate() - (startDow === 0 ? 6 : startDow - 1));
  
  // End at the Sunday of the week containing 'to'
  const endDate = new Date(to + "T12:00:00");
  const endDow = endDate.getDay();
  const lastSunday = new Date(endDate);
  lastSunday.setDate(endDate.getDate() + (endDow === 0 ? 0 : 7 - endDow));
  
  const cur = new Date(firstMonday);
  const end = new Date(lastSunday);

  while (cur <= end) {
    const date = toDateString(cur);
    const dp = emp.filter((p) => p.timestamp.split("T")[0] === date);
    const ci = dp.find((p) => p.log_type === "time-in") ?? null;
    const co = dp.find((p) => p.log_type === "time-out") ?? null;
    const ab = dp.find((p) => p.log_type === "absence") ?? null;
    const dow = cur.getDay();
    
    // Check if this date is outside the filter range
    const isOutsideRange = date < from || date > to;

    result.push({
      date,
      ci: ci?.timestamp ?? null,
      co: co?.timestamp ?? null,
      hours: ci && co ? computeHoursDecimal(ci.timestamp, co.timestamp) : null,
      absent: !!ab,
      absenceReason: ab?.absence_reason ?? null,
      isWeekend: dow === 0 || dow === 6,
      isFuture: date > today,
      isLate: ci ? isLate(ci.timestamp) : false,
      isOutsideRange, // New flag for styling
    });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

type WeekGroup = {
  weekNumber: number;
  key: string;
  days: SliderDay[];
  totalHours: number;
  workdayCount: number;
};

function groupIntoWeeks(days: SliderDay[], monthStart: Date): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  const weekNumbers = new Map<string, number>();

  // Find first Monday of the month
  const firstMonday = new Date(monthStart);
  while (firstMonday.getDay() !== 1) {
    firstMonday.setDate(firstMonday.getDate() + 1);
  }

  for (const day of days) {
    const d = new Date(day.date + "T12:00:00");
    const dow = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const key = toDateString(mon);

    // Calculate week number
    if (!weekNumbers.has(key)) {
      const weeksDiff = Math.floor(
        (mon.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      weekNumbers.set(key, weeksDiff + 1);
    }

    const weekNumber = weekNumbers.get(key)!;

    if (!map.has(key)) {
      map.set(key, {
        weekNumber,
        key,
        days: [],
        totalHours: 0,
        workdayCount: 0,
      });
    }

    const g = map.get(key)!;
    g.days.push(day);
    g.totalHours += day.hours ?? 0;
    if (!day.isWeekend && !day.isFuture) g.workdayCount++;
  }

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ─── Compact Day Row ──────────────────────────────────────────────────────────

function DayCompactRow({ day }: Readonly<{ day: SliderDay }>) {
  const d = new Date(day.date + "T12:00:00");
  const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const isWeekendEmpty = day.isWeekend && !day.ci && !day.absent && !day.isFuture;
  const isNonWorkingDay = day.isScheduledWorkday === false;

  const dotCls = day.isFuture
    ? "bg-slate-200"
    : day.absent
    ? "bg-purple-400"
    : day.ci && day.isLate
    ? "bg-amber-400"
    : day.ci
    ? "bg-green-500"
    : isWeekendEmpty || isNonWorkingDay
    ? "bg-slate-300"
    : "bg-red-300";

  // Apply visual distinction for days outside the current month range
  const outsideRangeClass = day.isOutsideRange ? "opacity-50" : "";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 ${
        isWeekendEmpty ? "opacity-40" : outsideRangeClass
      }`}
    >
      <div className={`h-2 w-2 rounded-full shrink-0 ${dotCls}`} />
      <div className="w-[68px] shrink-0">
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
          {dayLabel}
        </p>
        <p className="text-xs font-bold leading-snug mt-0.5">{dateLabel}</p>
      </div>

      {isNonWorkingDay && !day.ci && !day.absent ? (
        <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded font-bold uppercase tracking-wide">
          Rest Day
        </span>
      ) : day.isFuture ? (
        <p className="text-xs text-muted-foreground/60 italic">Upcoming</p>
      ) : isWeekendEmpty ? (
        <p className="text-xs text-muted-foreground/50">Weekend</p>
      ) : day.absent ? (
        <p className="text-xs text-purple-600 font-medium">
          {day.absenceReason ?? "Excused absence"}
        </p>
      ) : day.ci ? (
        <div className="flex items-center gap-1.5 flex-1 min-w-0 text-xs">
          <span className="font-semibold tabular-nums">{formatTime(day.ci)}</span>
          <span className="text-muted-foreground text-[10px]">→</span>
          <span className={`font-semibold tabular-nums ${!day.co ? "text-blue-500" : ""}`}>
            {day.co ? formatTime(day.co) : "…"}
          </span>
          {day.hours && (
            <span className="ml-auto shrink-0 text-[10px] font-bold text-muted-foreground tabular-nums">
              {day.hours.toFixed(1)}h
            </span>
          )}
          <div className="flex gap-1 shrink-0">
            {day.isLate && (
              <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-bold">
                Late
              </span>
            )}
            {(day.hours ?? 0) > 8 && (
              <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-bold">
                OT
              </span>
            )}
            {isNonWorkingDay && (
              <span className="text-[9px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
                EXTRA DAY
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No record</p>
      )}
    </div>
  );
}

// ─── Attendance Summary Bar ───────────────────────────────────────────────────

function AttendanceSummary({ days }: Readonly<{ days: SliderDay[] }>) {
  const workdays = days.filter((d) => !d.isWeekend && !d.isFuture);
  const present = workdays.filter((d) => d.ci && !d.absent).length;
  const lateCount = workdays.filter((d) => d.ci && d.isLate).length;
  const absentCount = workdays.filter((d) => !d.ci && !d.absent).length;
  const excused = workdays.filter((d) => d.absent).length;
  const compliance =
    workdays.length > 0 ? Math.round((present / workdays.length) * 100) : 0;
  const compCls =
    compliance >= 90 ? "text-green-600" : compliance >= 70 ? "text-amber-600" : "text-red-500";

  return (
    <div className="shrink-0 border-b border-border bg-muted/10">
      <div className="grid grid-cols-5 divide-x divide-border/60">
        {[
          { label: "Present", value: String(present), cls: "text-green-600" },
          { label: "Late", value: String(lateCount), cls: "text-amber-600" },
          { label: "Absent", value: String(absentCount), cls: "text-red-500" },
          { label: "Excused", value: String(excused), cls: "text-purple-600" },
          { label: "Compliance", value: `${compliance}%`, cls: compCls },
        ].map(({ label, value, cls }) => (
          <div key={label} className="flex flex-col items-center py-3 px-1">
            <p className={`text-sm font-bold ${cls}`}>{value}</p>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5 text-center leading-tight">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Employee Slide-Over ──────────────────────────────────────────────────────

function EmployeeSlideOver({
  name,
  employeeId,
  userId,
  dashboardFilter,
  dashboardFrom,
  dashboardTo,
  onClose,
}: Readonly<{
  name: string;
  employeeId: string;
  userId: string;
  dashboardFilter: ViewMode;
  dashboardFrom: string;
  dashboardTo: string;
  onClose: () => void;
}>) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>("today");
  const [todayDetail, setTodayDetail] = useState<EmployeeDetail | null>(null);
  const [allPunches, setAllPunches] = useState<PunchRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const today = toDateString(new Date());

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Fetch today's detail for Today & Schedule tabs
  useEffect(() => {
    setFetching(true);
    authFetch(`${API_BASE_URL}/timekeeping/timesheets/${userId}/${today}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTodayDetail(data as EmployeeDetail | null))
      .catch(() => setTodayDetail(null))
      .finally(() => setFetching(false));
  }, [userId, today]);

  // Fetch range data for Schedule & Attendance Details tabs
  useEffect(() => {
    if (dashboardFilter === "day") return; // No need for range data in day view

    setFetching(true);
    authFetch(`${API_BASE_URL}/timekeeping/timesheets?from=${dashboardFrom}&to=${dashboardTo}`)
      .then((r) => (r.ok ? (r.json() as Promise<PunchRow[]>) : Promise.resolve([])))
      .then((data) => setAllPunches(data))
      .catch(() => setAllPunches([]))
      .finally(() => setFetching(false));
  }, [dashboardFrom, dashboardTo, dashboardFilter]);

  const handleClose = () => {
    setMounted(false);
    setTimeout(onClose, 260);
  };

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const TABS: { key: TabMode; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "schedule", label: "Schedule" },
    { key: "attendance", label: "Attendance Details" },
  ];

  // Today data - declare schedule first since sliderDays needs it
  const todayPunches = todayDetail?.punches ?? [];
  const timeIn = todayPunches.find((p) => p.log_type === "time-in") ?? null;
  const timeOut = todayPunches.find((p) => p.log_type === "time-out") ?? null;
  const schedule = todayDetail?.schedule ?? null;

  // Data for attendance tab
  const allSliderDays =
    dashboardFilter !== "day" ? buildSliderDays(allPunches, employeeId, dashboardFrom, dashboardTo) : [];
  
  // Mark non-working days based on schedule
  const sliderDays = schedule ? allSliderDays.map((day) => {
    const dayOfWeek = new Date(day.date + "T12:00:00").getDay();
    const workdaysStr = typeof schedule.workdays === "string" ? schedule.workdays : schedule.workdays.join(",");
    const workdayNames = workdaysStr.toUpperCase().split(",");
    const dayMap: Record<string, number> = {
      SUN: 0, MON: 1, TUES: 2, TUE: 2, WED: 3, THURS: 4, THU: 4, FRI: 5, SAT: 6,
    };
    const workdayIndices = workdayNames.map((d) => dayMap[d.trim()]).filter((i) => i !== undefined);
    const isScheduledWorkday = workdayIndices.includes(dayOfWeek);
    
    return {
      ...day,
      isScheduledWorkday, // New flag to identify if this is a scheduled workday
    };
  }) : allSliderDays.map((day) => ({ ...day, isScheduledWorkday: true })); // If no schedule, assume all days are workdays
  
  const monthStart = dashboardFilter === "month" ? new Date(dashboardFrom + "T12:00:00") : new Date();
  const weekGroups = dashboardFilter === "month" ? groupIntoWeeks(sliderDays, monthStart) : [];

  // Calculate worked hours for Schedule tab
  const calculateWorkedHours = (): { totalHours: number; scheduledDays: number } => {
    if (dashboardFilter === "day" || !schedule) {
      return { totalHours: 0, scheduledDays: 0 };
    }

    const workdaysStr =
      typeof schedule.workdays === "string" ? schedule.workdays : schedule.workdays.join(",");
    const workdayNames = workdaysStr.toUpperCase().split(",");
    const dayMap: Record<string, number> = {
      SUN: 0,
      MON: 1,
      TUES: 2,
      TUE: 2,
      WED: 3,
      THURS: 4,
      THU: 4,
      FRI: 5,
      SAT: 6,
    };
    const workdayIndices = workdayNames.map((d) => dayMap[d.trim()]).filter((i) => i !== undefined);

    // Count scheduled days in range
    let scheduledDays = 0;
    const cur = new Date(dashboardFrom + "T12:00:00");
    const end = new Date(dashboardTo + "T12:00:00");
    while (cur <= end) {
      if (workdayIndices.includes(cur.getDay())) scheduledDays++;
      cur.setDate(cur.getDate() + 1);
    }

    // Calculate actual worked hours
    const empPunches = allPunches.filter((p) => p.employee_id === employeeId);
    const dailyLogs = new Map<string, { ci: string | null; co: string | null }>();

    for (const p of empPunches) {
      const date = p.timestamp.split("T")[0];
      if (!dailyLogs.has(date)) dailyLogs.set(date, { ci: null, co: null });
      const log = dailyLogs.get(date)!;
      if (p.log_type === "time-in" && !log.ci) log.ci = p.timestamp;
      if (p.log_type === "time-out") log.co = p.timestamp;
    }

    let totalHours = 0;

    for (const [_, log] of dailyLogs) {
      if (log.ci && log.co) {
        const worked = computeHoursDecimal(log.ci, log.co) ?? 0;
        // Deduct 1 hour for break
        totalHours += Math.max(0, worked - 1);
      }
    }

    return { totalHours, scheduledDays };
  };

  const { totalHours, scheduledDays } = calculateWorkedHours();

  const toggleWeek = (key: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity duration-200 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md z-50 bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          mounted ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm border border-primary/10 shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{employeeId}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 bg-background">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {fetching ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Loading records…</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {/* ── TODAY TAB ──────────────────────────────────────────────── */}
            {activeTab === "today" && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    {
                      label: "Time In",
                      value: formatTime(timeIn?.timestamp ?? null),
                      icon: LogIn,
                      cls: "text-green-600",
                    },
                    {
                      label: "Time Out",
                      value: formatTime(timeOut?.timestamp ?? null),
                      icon: LogOut,
                      cls: "text-red-500",
                    },
                    {
                      label: "Hours",
                      value: formatHoursLabel(timeIn?.timestamp ?? null, timeOut?.timestamp ?? null),
                      icon: Timer,
                      cls: "text-blue-600",
                    },
                  ].map(({ label, value, icon: Icon, cls }) => (
                    <div
                      key={label}
                      className="p-3 rounded-xl border border-border bg-background text-center"
                    >
                      <Icon className={`h-4 w-4 mx-auto mb-1 ${cls}`} />
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                        {label}
                      </p>
                      <p className="font-bold text-sm">{value}</p>
                    </div>
                  ))}
                </div>

                {todayPunches.length > 0 ? (
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
                      Timeline
                    </p>
                    <div className="rounded-xl border border-border overflow-hidden">
                      {todayPunches.map((p) => {
                        const isIn = p.log_type === "time-in";
                        const isOut = p.log_type === "time-out";
                        return (
                          <div
                            key={p.log_id}
                            className="flex items-start gap-3 px-4 py-3 border-b border-border/40 last:border-0"
                          >
                            <div
                              className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 border ${
                                isIn
                                  ? "bg-green-100 border-green-200"
                                  : isOut
                                  ? "bg-red-50 border-red-200"
                                  : "bg-purple-50 border-purple-200"
                              }`}
                            >
                              {isIn ? (
                                <LogIn className="h-3 w-3 text-green-600" />
                              ) : isOut ? (
                                <LogOut className="h-3 w-3 text-red-500" />
                              ) : (
                                <FileX className="h-3 w-3 text-purple-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold capitalize">
                                  {p.log_type.replace("-", " ")}
                                </p>
                                <p className="text-xs font-mono text-muted-foreground">
                                  {formatTime(p.timestamp)}
                                </p>
                              </div>
                              {p.latitude && p.longitude ? (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 text-green-600" />
                                  {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                                </p>
                              ) : (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPinOff className="h-3 w-3" /> No GPS
                                </p>
                              )}
                              {p.clock_type && (
                                <span
                                  className={`mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    p.clock_type === "LATE"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {p.clock_type}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No punch records for today.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── SCHEDULE TAB ───────────────────────────────────────────── */}
            {activeTab === "schedule" && (
              <div className="p-5 space-y-4">
                {schedule ? (
                  <>
                    <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                        Scheduled Time
                      </p>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-semibold">{schedule.start_time}</span>
                        <span className="text-muted-foreground text-xs">→</span>
                        <span className="font-semibold">{schedule.end_time}</span>
                        {schedule.is_nightshift && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                            Night Shift
                          </span>
                        )}
                      </div>
                    </div>

                    {dashboardFilter !== "day" && (
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                          {dashboardFilter === "week"
                            ? "This Week"
                            : dashboardFilter === "month"
                            ? "This Month"
                            : "Selected Period"}
                        </p>
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="text-2xl font-bold text-primary">
                            {totalHours.toFixed(1)}h
                          </span>
                          <span className="text-muted-foreground">total</span>
                          <span className="mx-2 text-border">|</span>
                          <span className="text-lg font-bold">{scheduledDays}</span>
                          <span className="text-muted-foreground">scheduled workdays</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-10">
                    <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No schedule assigned.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── ATTENDANCE DETAILS TAB ─────────────────────────────────── */}
            {activeTab === "attendance" && (
              <>
                {dashboardFilter === "day" ? (
                  // Show same as Today tab when filter is Day
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        {
                          label: "Time In",
                          value: formatTime(timeIn?.timestamp ?? null),
                          icon: LogIn,
                          cls: "text-green-600",
                        },
                        {
                          label: "Time Out",
                          value: formatTime(timeOut?.timestamp ?? null),
                          icon: LogOut,
                          cls: "text-red-500",
                        },
                        {
                          label: "Hours",
                          value: formatHoursLabel(
                            timeIn?.timestamp ?? null,
                            timeOut?.timestamp ?? null
                          ),
                          icon: Timer,
                          cls: "text-blue-600",
                        },
                      ].map(({ label, value, icon: Icon, cls }) => (
                        <div
                          key={label}
                          className="p-3 rounded-xl border border-border bg-background text-center"
                        >
                          <Icon className={`h-4 w-4 mx-auto mb-1 ${cls}`} />
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                            {label}
                          </p>
                          <p className="font-bold text-sm">{value}</p>
                        </div>
                      ))}
                    </div>

                    {todayPunches.length > 0 ? (
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
                          Timeline
                        </p>
                        <div className="rounded-xl border border-border overflow-hidden">
                          {todayPunches.map((p) => {
                            const isIn = p.log_type === "time-in";
                            const isOut = p.log_type === "time-out";
                            return (
                              <div
                                key={p.log_id}
                                className="flex items-start gap-3 px-4 py-3 border-b border-border/40 last:border-0"
                              >
                                <div
                                  className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 border ${
                                    isIn
                                      ? "bg-green-100 border-green-200"
                                      : isOut
                                      ? "bg-red-50 border-red-200"
                                      : "bg-purple-50 border-purple-200"
                                  }`}
                                >
                                  {isIn ? (
                                    <LogIn className="h-3 w-3 text-green-600" />
                                  ) : isOut ? (
                                    <LogOut className="h-3 w-3 text-red-500" />
                                  ) : (
                                    <FileX className="h-3 w-3 text-purple-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold capitalize">
                                      {p.log_type.replace("-", " ")}
                                    </p>
                                    <p className="text-xs font-mono text-muted-foreground">
                                      {formatTime(p.timestamp)}
                                    </p>
                                  </div>
                                  {p.latitude && p.longitude ? (
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <MapPin className="h-3 w-3 text-green-600" />
                                      {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <MapPinOff className="h-3 w-3" /> No GPS
                                    </p>
                                  )}
                                  {p.clock_type && (
                                    <span
                                      className={`mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                        p.clock_type === "LATE"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-green-100 text-green-700"
                                      }`}
                                    >
                                      {p.clock_type}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10">
                        <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">No punch records for today.</p>
                      </div>
                    )}
                  </div>
                ) : dashboardFilter === "week" ? (
                  // Weekly view - show summary + daily list
                  <>
                    <AttendanceSummary days={sliderDays} />
                    <div>
                      {sliderDays.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">
                          No records this week.
                        </p>
                      ) : (
                        sliderDays.map((day) => <DayCompactRow key={day.date} day={day} />)
                      )}
                    </div>
                  </>
                ) : (
                  // Monthly or Custom view - show summary + weekly groups
                  <>
                    <AttendanceSummary days={sliderDays} />
                    <div className="p-3 space-y-2">
                      {weekGroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No records in this period.
                        </p>
                      ) : (
                        weekGroups.map((group) => {
                          const isExpanded = expandedWeeks.has(group.key);
                          const presentDays = group.days.filter(
                            (d) => d.ci && !d.absent && !d.isFuture
                          ).length;
                          return (
                            <div
                              key={group.key}
                              className="rounded-xl border border-border overflow-hidden"
                            >
                              <button
                                onClick={() => toggleWeek(group.key)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 text-left">
                                  <ChevronRight
                                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${
                                      isExpanded ? "rotate-90" : ""
                                    }`}
                                  />
                                  <div>
                                    <p className="text-xs font-bold">Week {group.weekNumber}</p>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">
                                      {presentDays} present · {group.totalHours.toFixed(1)}h
                                    </p>
                                  </div>
                                </div>
                                {/* Dot strip preview */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {group.days
                                    .filter((d) => !d.isWeekend)
                                    .map((d) => (
                                      <div
                                        key={d.date}
                                        className={`h-2 w-2 rounded-full ${
                                          d.isFuture
                                            ? "bg-slate-200"
                                            : d.absent
                                            ? "bg-purple-400"
                                            : d.ci && d.isLate
                                            ? "bg-amber-400"
                                            : d.ci
                                            ? "bg-green-500"
                                            : "bg-red-300"
                                        }`}
                                      />
                                    ))}
                                </div>
                              </button>
                              {isExpanded && (
                                <div className="bg-background">
                                  {group.days.map((day) => (
                                    <DayCompactRow key={day.date} day={day} />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Filter constants ─────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "present",    label: "Present" },
  { value: "absent",     label: "Absent" },
  { value: "excused",    label: "Excused" },
  { value: "late",       label: "Late" },
  { value: "clocked-in", label: "Clocked In" },
];

const ITEMS_PER_PAGE = 8;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HRTimekeepingPage() {
  const [viewMode, setViewMode]         = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customFrom, setCustomFrom]     = useState("");
  const [customTo, setCustomTo]         = useState("");
  const [roster, setRoster]             = useState<RosterEntry[]>([]);
  const [periodData, setPeriodData]     = useState<PeriodEntry[]>([]);
  const [users, setUsers]               = useState<UserRow[]>([]);
  const [allPunches, setAllPunches]     = useState<PunchRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState(false);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage]                 = useState(1);

  // Slide-over
  const [drillUser, setDrillUser] = useState<{ userId: string; employeeId: string; name: string } | null>(null);

  const weekRange  = useMemo(() => getWeekRange(), []);
  const monthRange = useMemo(() => getMonthRange(), []);

  const { from, to } = useMemo(() => {
    if (viewMode === "week")   return { from: weekRange.from,  to: weekRange.to };
    if (viewMode === "month")  return { from: monthRange.from, to: monthRange.to };
    if (viewMode === "custom") return { from: customFrom || toDateString(new Date()), to: customTo || toDateString(new Date()) };
    const d = toDateString(selectedDate);
    return { from: d, to: d };
  }, [viewMode, selectedDate, weekRange, monthRange, customFrom, customTo]);

  useEffect(() => {
    if (viewMode === "custom" && (!customFrom || !customTo)) return;

    setLoading(true);
    setFetchError(false);
    setPage(1);

    Promise.all([
      authFetch(`${API_BASE_URL}/timekeeping/employees`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<UserRow[]>; }),
      authFetch(`${API_BASE_URL}/timekeeping/timesheets?from=${from}&to=${to}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<PunchRow[]>; }),
    ])
      .then(([u, p]) => {
        setUsers(u);
        setAllPunches(p);
        if (viewMode === "day") {
          setRoster(buildFullRoster(u, p));
          setPeriodData([]);
        } else {
          setPeriodData(buildPeriodRoster(u, p, from, to));
          setRoster([]);
        }
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [from, to, viewMode]);

  // Open drill-down panel — slide-over fetches its own data per selected period
  const openDrill = useCallback((userId: string, employeeId: string, name: string) => {
    setDrillUser({ userId, employeeId, name });
  }, []);

  const stats       = useMemo(() => computeStats(roster), [roster]);
  const periodStats = useMemo(() => computePeriodStats(periodData), [periodData]);

  const isDayView  = viewMode === "day";
  const isPeriod   = !isDayView;

  const filteredRoster = useMemo(() => {
    const q = search.toLowerCase();
    return roster.filter(r => {
      const name = `${r.first_name} ${r.last_name}`.toLowerCase();
      const matchSearch = name.includes(q) || r.employee_id.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [roster, search, statusFilter]);

  const filteredPeriod = useMemo(() => {
    const q = search.toLowerCase();
    return periodData.filter(e => {
      const name = `${e.first_name} ${e.last_name}`.toLowerCase();
      return name.includes(q) || e.employee_id.toLowerCase().includes(q);
    });
  }, [periodData, search]);

  const activeList = isDayView ? filteredRoster : filteredPeriod;
  const totalPages = Math.ceil(activeList.length / ITEMS_PER_PAGE);
  const paged      = activeList.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  function goToPrev()  { setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }); }
  function goToNext()  { setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }); }
  function goToToday() { setSelectedDate(new Date()); }

  const colSpan = isDayView ? 7 : 8;

  const periodLabel = viewMode === "week" ? weekRange.label
    : viewMode === "month" ? monthRange.label
    : viewMode === "custom" && customFrom && customTo ? `${customFrom} → ${customTo}`
    : "";

  // Table rows
  const tableBody = loading ? (
    <tr><td colSpan={colSpan} className="px-6 py-12 text-center text-muted-foreground text-sm">Loading timekeeping data...</td></tr>
  ) : fetchError ? (
    <tr><td colSpan={colSpan} className="px-6 py-12 text-center text-destructive text-sm">Failed to load data. Please refresh or contact support.</td></tr>
  ) : activeList.length === 0 ? (
    <tr><td colSpan={colSpan} className="px-6 py-12 text-center text-muted-foreground text-sm">
      {search ? "No records match your search." : "No entries found for this period."}
    </td></tr>
  ) : isDayView ? (
    (paged as RosterEntry[]).map(row => (
      <tr
        key={row.employee_id}
        className="hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => openDrill(row.user_id, row.employee_id, `${row.first_name} ${row.last_name}`)}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-xs border border-primary/5 shrink-0">
              {row.first_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{`${row.first_name} ${row.last_name}`.trim()}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{row.employee_id}</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-xs font-medium">{formatTime(row.time_in)}</td>
        <td className="px-6 py-4 text-xs font-medium">{formatTime(row.time_out)}</td>
        <td className="px-6 py-4 text-xs font-medium">{formatHoursLabel(row.time_in, row.time_out)}</td>
        <td className="px-6 py-4"><StatusBadge status={row.status} /></td>
        <td className="px-6 py-4">
          {row.absence_reason ? (
            <div className="flex items-center gap-1.5 text-purple-600">
              <FileX className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[10px] font-semibold">{row.absence_reason}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        <td className="px-6 py-4">
          {row.status === "absent" || row.status === "excused" ? (
            <span className="text-muted-foreground text-xs">—</span>
          ) : row.gps_verified ? (
            <div className="flex items-center gap-1.5 text-green-600">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Verified</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPinOff className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">No GPS</span>
            </div>
          )}
        </td>
      </tr>
    ))
  ) : (
    (paged as PeriodEntry[]).map(e => (
      <tr
        key={e.employee_id}
        className="hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => openDrill(e.user_id, e.employee_id, `${e.first_name} ${e.last_name}`)}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-xs border border-primary/5 shrink-0">
              {e.first_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{`${e.first_name} ${e.last_name}`.trim()}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{e.employee_id}</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">{e.days_present}d</span>
            {e.flagged && <FlagBadge reason={e.flag_reason} />}
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-0.5">{e.days_absent}d</span>
        </td>
        <td className="px-6 py-4">
          {e.days_late > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">{e.days_late}d</span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-6 py-4 text-sm font-bold">{e.total_hours.toFixed(1)}h</td>
        <td className="px-6 py-4">
          {e.overtime_hours > 0 ? (
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-0.5">+{e.overtime_hours.toFixed(1)}h</span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-6 py-4"><CompliancePill rate={e.compliance_rate} /></td>
        <td className="px-6 py-4 text-xs text-muted-foreground">
          {e.days_present > 0 ? `${(e.total_hours / e.days_present).toFixed(1)}h avg/day` : "—"}
        </td>
      </tr>
    ))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Slide-Over */}
      {drillUser && (
        <EmployeeSlideOver
          name={drillUser.name}
          employeeId={drillUser.employeeId}
          userId={drillUser.userId}
          dashboardFilter={viewMode}
          dashboardFrom={from}
          dashboardTo={to}
          onClose={() => setDrillUser(null)}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Timekeeping Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Company-wide attendance and compliance tracking</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode tabs */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
            {(["day", "week", "month", "custom"] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => { setViewMode(v); setPage(1); }}
                className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewMode === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v === "day"    && <CalendarDays className="h-3.5 w-3.5" />}
                {v === "week"   && <CalendarDays className="h-3.5 w-3.5" />}
                {v === "month"  && <BarChart2 className="h-3.5 w-3.5" />}
                {v === "custom" && <Search className="h-3.5 w-3.5" />}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Day nav */}
          {viewMode === "day" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={isToday(selectedDate) ? "default" : "outline"}
                className="h-9 px-4 text-sm font-semibold"
                onClick={goToToday}
              >
                {isToday(selectedDate) ? "Today" : "Go to Today"}
              </Button>
              <div className="h-9 px-4 flex items-center border border-border rounded-md text-sm font-medium bg-background min-w-44 justify-center">
                {formatDisplayDate(selectedDate)}
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNext} disabled={isToday(selectedDate)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Period label */}
          {(viewMode === "week" || viewMode === "month") && (
            <div className="h-9 px-4 flex items-center border border-border rounded-md text-sm font-medium bg-background">
              {periodLabel}
            </div>
          )}

          {/* Custom range pickers */}
          {viewMode === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={e => { setCustomFrom(e.target.value); setPage(1); }}
                max={customTo || toDateString(new Date())}
                className="h-9 px-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => { setCustomTo(e.target.value); setPage(1); }}
                min={customFrom}
                max={toDateString(new Date())}
                className="h-9 px-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 cursor-pointer"
            disabled={activeList.length === 0 || loading}
            onClick={() => downloadCSV(activeList as any, isDayView, isDayView ? formatDisplayDate(selectedDate) : periodLabel)}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      {isDayView ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users}      label="Total Employees"   value={String(stats.total)}               sub="tracked"                              colorClass="bg-primary/10 text-primary" />
          <StatCard icon={TrendingUp} label="Attendance Rate"   value={`${stats.attendance_rate}%`}       sub={`${stats.present + stats.late} present`} colorClass="bg-green-50 text-green-600" />
          <StatCard icon={BarChart2}  label="Total Hours"       value={`${stats.totalHours.toFixed(1)}h`} sub={`${stats.avgHours.toFixed(1)}h avg`}  colorClass="bg-blue-50 text-blue-600" />
          <StatCard icon={Timer}      label="Compliance Issues" value={String(stats.late + stats.absent)} sub={`${stats.late} late · ${stats.absent} absent`} colorClass="bg-red-50 text-red-600" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={Users}     label="Employees"      value={String(periodStats.total)}                  sub="in period"          colorClass="bg-primary/10 text-primary" />
          <StatCard icon={BarChart2} label="Total Hours"    value={`${periodStats.totalHours.toFixed(1)}h`}    sub={periodLabel}        colorClass="bg-blue-50 text-blue-600" />
          <StatCard icon={Timer}     label="Avg Per Person" value={`${periodStats.avgHours.toFixed(1)}h`}      sub="across period"      colorClass="bg-green-50 text-green-600" />
          <StatCard icon={TrendingUp} label="Avg Compliance" value={`${periodStats.avgCompliance.toFixed(0)}%`} sub="attendance rate"   colorClass="bg-indigo-50 text-indigo-600" />
          <StatCard icon={AlertTriangle} label="Flagged Employees" value={String(periodStats.flaggedCount)} sub=">3 absent or >2 late" colorClass="bg-red-50 text-red-600" />
        </div>
      )}

      {/* ── Top Performers (period only) ─────────────────────────────────────── */}
      {isPeriod && !loading && periodData.length > 0 && (
        <TopPerformersBar entries={periodData} />
      )}

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-6 bg-muted/20 border-b border-border">
          {isDayView ? (
            <div className="flex gap-1.5 flex-wrap">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors cursor-pointer ${
                    statusFilter === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {viewMode === "week" ? "Weekly" : viewMode === "month" ? "Monthly" : "Custom"} Summary — per employee
              </p>
              {periodStats.flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold">
                  <AlertTriangle className="h-3 w-3" />
                  {periodStats.flaggedCount} flagged
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground">Click any row to see details</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 w-52 bg-background"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Employee</th>
                {isDayView ? (
                  <>
                    <th className="px-6 py-4">Time In</th>
                    <th className="px-6 py-4">Time Out</th>
                    <th className="px-6 py-4">Hours</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">GPS</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4">Days Present</th>
                    <th className="px-6 py-4">Days Absent</th>
                    <th className="px-6 py-4">Days Late</th>
                    <th className="px-6 py-4">Total Hours</th>
                    <th className="px-6 py-4">Overtime</th>
                    <th className="px-6 py-4">Compliance</th>
                    <th className="px-6 py-4">Average</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tableBody}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-muted/10 border-t border-border flex items-center justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {activeList.length > 0
              ? `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, activeList.length)} of ${activeList.length}`
              : "No results"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1"
              onClick={() => setPage(p => p - 1)} disabled={page === 1 || totalPages === 0}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1"
              onClick={() => setPage(p => p + 1)} disabled={page === totalPages || totalPages === 0}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}