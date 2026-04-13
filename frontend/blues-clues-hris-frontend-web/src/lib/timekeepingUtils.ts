export type TimekeepingStatus = "present" | "absent" | "late" | "on-leave";

// GET /users response row
export type UserRow = {
  user_id: string;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  account_status: string | null;
};

// GET /timekeeping/timesheets response row — one per punch event
export type PunchRow = {
  log_id: string;
  employee_id: string;
  log_type: "time-in" | "time-out";
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  ip_address: string | null;
  is_mock_location: string;
  log_status: string;
};

// Display row after transformation
export type TimekeepingLog = {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  status: TimekeepingStatus;
  gps_verified: boolean;
};

export type TimekeepingStats = {
  total: number;
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  attendance_rate: number;
  avg_hours: number;
};

// Employees who punch in at or after this hour (PST) are considered late
const LATE_THRESHOLD_HOUR_PST = 9;

// Supabase returns `timestamp without time zone` columns without the Z suffix.
// JavaScript treats those as local time, not UTC. Appending Z forces UTC parsing.
function parseTs(ts: string): Date {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return parseTs(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila",
  });
}

export function formatHoursFromDecimal(hours: number | null): string {
  if (hours === null) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatHoursFromTimestamps(
  timeIn: string | null | undefined,
  timeOut: string | null | undefined
): string {
  if (!timeIn || !timeOut) return "—";
  const diff = (parseTs(timeOut).getTime() - parseTs(timeIn).getTime()) / 3_600_000;
  return formatHoursFromDecimal(diff);
}

export function todayPST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function toDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function isToday(date: Date): boolean {
  return toDateString(date) === toDateString(new Date());
}

export function deriveStatus(timeIn: string | null): TimekeepingStatus {
  if (!timeIn) return "absent";
  const hourPST = Number.parseInt(
    parseTs(timeIn).toLocaleString("en-US", {
      hour: "numeric", hour12: false, timeZone: "Asia/Manila",
    }),
    10
  );
  return hourPST >= LATE_THRESHOLD_HOUR_PST ? "late" : "present";
}

// Merges full user roster with punch records — absent employees still appear
export function buildFullRoster(users: UserRow[], punches: PunchRow[]): TimekeepingLog[] {
  // Build punch map keyed by employee_id
  const punchMap: Record<string, { timeIn: PunchRow | null; timeOut: PunchRow | null }> = {};

  for (const row of punches) {
    if (!punchMap[row.employee_id]) {
      punchMap[row.employee_id] = { timeIn: null, timeOut: null };
    }
    if (row.log_type === "time-in"  && !punchMap[row.employee_id].timeIn)  {
      punchMap[row.employee_id].timeIn  = row;
    }
    if (row.log_type === "time-out") {
      punchMap[row.employee_id].timeOut = row;
    }
  }

  return users
    .filter(u => u.account_status?.toLowerCase() !== "inactive")
    .map(u => {
      const punched   = punchMap[u.employee_id] ?? { timeIn: null, timeOut: null };
      const timeInTs  = punched.timeIn?.timestamp  ?? null;
      const timeOutTs = punched.timeOut?.timestamp ?? null;

      let hours_worked: number | null = null;
      if (timeInTs && timeOutTs) {
        hours_worked = (new Date(timeOutTs).getTime() - new Date(timeInTs).getTime()) / 3_600_000;
      }

      return {
        user_id:      u.user_id,
        employee_id:  u.employee_id,
        first_name:   u.first_name  ?? "Unknown",
        last_name:    u.last_name   ?? "",
        time_in:      timeInTs,
        time_out:     timeOutTs,
        hours_worked,
        status:       deriveStatus(timeInTs),
        gps_verified: !!(punched.timeIn?.latitude != null && punched.timeIn?.longitude != null),
      };
    });
}

export function computeStats(logs: TimekeepingLog[]): TimekeepingStats {
  const total    = logs.length;
  const present  = logs.filter(l => l.status === "present").length;
  const absent   = logs.filter(l => l.status === "absent").length;
  const late     = logs.filter(l => l.status === "late").length;
  const on_leave = logs.filter(l => l.status === "on-leave").length;
  const attended = present + late;
  const attendance_rate = total > 0 ? Math.round((attended / total) * 100) : 0;

  const worked = logs.filter(l => l.hours_worked !== null).map(l => l.hours_worked as number);
  const avg_hours = worked.length > 0 ? worked.reduce((a, b) => a + b, 0) / worked.length : 0;

  return { total, present, absent, late, on_leave, attendance_rate, avg_hours };
}
