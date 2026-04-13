"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getUserInfo, getAccessToken, parseJwt } from "@/lib/authStorage";
import { authFetch, getHRInterviewNotifications, HRInterviewNotification } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";
import {
  MoreHorizontal, Filter, Download,
  Search, ChevronLeft, ChevronRight, UserX,
  UserCheck, Check,
  Users, UserPlus, Briefcase, FileText, CalendarCheck, Bell,
  ArrowRight, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  user_id: string;
  employee_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_id: string | null;
  department_id: string | null;
  start_date: string | null;
  account_status: string | null;
  last_login: string | null;
  invite_expires_at: string | null;
};

type Role = { role_id: string; role_name: string };
type Department = { department_id: string; department_name: string };

interface JobSummary {
  job_posting_id: string;
  title: string;
  status: "open" | "closed" | "draft";
  posted_at: string;
  applicant_count?: number;
}

interface TodayPunch {
  employee_id: string;
  log_type: string;
  timestamp: string;
  clock_type?: string | null;
}

interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  noRecord: number;
  rate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const STATUS_STYLES: Record<string, string> = {
  Active:   "bg-green-100 text-green-700 border-green-200",
  Inactive: "bg-red-100 text-red-700 border-red-200",
  Pending:  "bg-amber-100 text-amber-700 border-amber-200",
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Request failed");
  return data as T;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function computeTodayAttendance(punches: TodayPunch[], employees: Employee[]): AttendanceStats {
  const byEmployee: Record<string, TodayPunch[]> = {};
  for (const p of punches) {
    if (!byEmployee[p.employee_id]) byEmployee[p.employee_id] = [];
    byEmployee[p.employee_id].push(p);
  }

  let present = 0, late = 0, absent = 0;
  const activeEmployees = employees.filter(e => e.account_status === "Active");

  for (const emp of activeEmployees) {
    const empPunches = byEmployee[emp.employee_id ?? ""] ?? [];
    const timeIn = empPunches.find(p => p.log_type === "time-in");
    if (!timeIn) {
      absent++;
    } else if (timeIn.clock_type === "LATE") {
      late++;
      present++;
    } else {
      present++;
    }
  }

  const noRecord = activeEmployees.length - present - absent;
  const rate = activeEmployees.length > 0
    ? Math.round((present / activeEmployees.length) * 100)
    : 0;

  return { present, late, absent: absent + Math.max(noRecord, 0), noRecord: 0, rate };
}

function getAttendanceColor(rate: number): string {
  if (rate >= 80) return "text-green-600";
  if (rate >= 60) return "text-amber-500";
  return "text-red-500";
}

function getAttendanceBarColor(rate: number): string {
  if (rate >= 80) return "bg-green-500";
  if (rate >= 60) return "bg-amber-500";
  return "bg-red-500";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, icon: Icon,
}: Readonly<{ label: string; value: number | string; sub: string; color: string; icon: React.ElementType }>) {
  return (
    <Card className="border-border/70 shadow-sm bg-[linear-gradient(160deg,rgba(37,99,235,0.05),rgba(15,23,42,0.00))]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${color} opacity-70`} />
        </div>
        <p className={`text-3xl font-bold tracking-tight ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${style}`}>
      {status}
    </span>
  );
}

function ResponseBadge({ response }: Readonly<{ response: string | null | undefined }>) {
  if (!response) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-slate-100 text-slate-600 border-slate-200">
        Awaiting
      </span>
    );
  }
  const map: Record<string, string> = {
    accepted:             "bg-green-100 text-green-700 border-green-200",
    declined:             "bg-red-100 text-red-700 border-red-200",
    reschedule_requested: "bg-amber-100 text-amber-700 border-amber-200",
  };
  const label: Record<string, string> = {
    accepted:             "Accepted",
    declined:             "Declined",
    reschedule_requested: "Reschedule",
  };
  const style = map[response] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${style}`}>
      {label[response] ?? response}
    </span>
  );
}

// Row action dropdown — HR can only deactivate or reactivate, not edit
function RowMenu({
  employee,
  onDeactivate,
  onReactivate,
}: Readonly<{
  employee: Employee;
  onDeactivate: () => void;
  onReactivate: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const insideButton = buttonRef.current?.contains(e.target as Node);
      const insideMenu = menuRef.current?.contains(e.target as Node);
      if (!insideButton && !insideMenu) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: globalThis.innerWidth - rect.right });
    }
    setOpen(v => !v);
  };

  return (
    <div>
      <Button
        ref={buttonRef}
        variant="ghost" size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={handleOpen}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && menuPos && (
        <div
          ref={menuRef}
          style={{ top: menuPos.top, right: menuPos.right }}
          className="fixed z-50 w-44 bg-card border border-border rounded-lg shadow-lg py-1 text-sm"
        >
          {employee.account_status === "Inactive" ? (
            <button
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-green-600"
              onClick={() => { onReactivate(); setOpen(false); }}
            >
              <UserCheck className="h-3.5 w-3.5" /> Reactivate
            </button>
          ) : (
            <button
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-red-600"
              onClick={() => { onDeactivate(); setOpen(false); }}
            >
              <UserX className="h-3.5 w-3.5" /> Deactivate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Deactivate confirmation dialog
function ConfirmDeactivate({
  employee,
  onClose,
  onConfirm,
}: Readonly<{
  employee: Employee;
  onClose: () => void;
  onConfirm: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-lg text-red-600">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Deactivate Account</h3>
            <p className="text-xs text-muted-foreground">This will revoke their access immediately</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Are you sure you want to deactivate <span className="font-semibold text-foreground">{employee.first_name} {employee.last_name}</span>? They will be logged out and unable to sign in.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>Deactivate</Button>
        </div>
      </div>
    </div>
  );
}

function OpenPositionsContent({ loading, jobs }: Readonly<{ loading: boolean; jobs: JobSummary[] }>) {
  if (loading) {
    return <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>;
  }
  if (jobs.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No open positions.{" "}
        <Link href="/hr/jobs" className="text-primary font-semibold hover:underline">Create one →</Link>
      </div>
    );
  }
  return (
    <>
      {jobs.slice(0, 5).map(job => (
        <div key={job.job_posting_id} className="flex items-center justify-between py-2.5 hover:bg-primary/5 -mx-5 px-5 transition-colors">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" /> {timeAgo(job.posted_at)}
            </p>
          </div>
          <span className="ml-3 shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-blue-50 text-blue-700 border-blue-200">
            {job.applicant_count ?? 0} apps
          </span>
        </div>
      ))}
    </>
  );
}

function InterviewFeedContent({ loading, notifications }: Readonly<{ loading: boolean; notifications: HRInterviewNotification[] }>) {
  if (loading) {
    return <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>;
  }
  if (notifications.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No interview responses yet.</div>;
  }
  return (
    <>
      {notifications.slice(0, 6).map(n => (
        <div key={n.schedule_id} className="flex items-center justify-between py-2.5 hover:bg-primary/5 -mx-5 px-5 transition-colors">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{n.first_name} {n.last_name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{n.job_title}</p>
          </div>
          <div className="ml-3 shrink-0 flex flex-col items-end gap-1">
            <ResponseBadge response={n.applicant_response} />
            {n.applicant_responded_at && (
              <span className="text-[10px] text-muted-foreground">{timeAgo(n.applicant_responded_at)}</span>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function AttendanceContent({ loading, error, stats }: Readonly<{ loading: boolean; error: boolean; stats: AttendanceStats }>) {
  if (error) {
    return <p className="text-sm text-muted-foreground text-center py-4">Attendance data unavailable.</p>;
  }
  if (loading) {
    return (
      <div className="flex gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-14 flex-1 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-center">
        <p className="text-2xl font-bold text-green-700">{stats.present}</p>
        <p className="text-[11px] font-bold uppercase tracking-wide text-green-600 mt-0.5">Present</p>
      </div>
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
        <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-500 mt-0.5">Late</p>
      </div>
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-center">
        <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
        <p className="text-[11px] font-bold uppercase tracking-wide text-red-500 mt-0.5">Absent</p>
      </div>
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-center">
        <p className="text-2xl font-bold text-slate-500">{stats.noRecord}</p>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">No Record</p>
      </div>
    </div>
  );
}

// Widget skeleton row
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="h-4 w-4/5 rounded bg-muted animate-pulse" />
      <div className="h-4 w-1/5 rounded bg-muted animate-pulse" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HRDashboardPage() {
  const user = getUserInfo();
  const currentUserId = parseJwt(getAccessToken() ?? "")?.sub_userid;
  useWelcomeToast(user?.name || "HR Officer", "HR Administration");

  // Employee directory state
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [roles, setRoles]               = useState<Role[]>([]);
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [confirmDeact, setConfirmDeact] = useState<Employee | null>(null);
  const [showFilter, setShowFilter]     = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const filterRef                       = useRef<HTMLDivElement>(null);

  // Widget state
  const [jobs, setJobs]                     = useState<JobSummary[]>([]);
  const [notifications, setNotifications]   = useState<HRInterviewNotification[]>([]);
  const [todayPunches, setTodayPunches]     = useState<TodayPunch[]>([]);
  const [loadingWidgets, setLoadingWidgets] = useState(true);
  const [attendanceError, setAttendanceError] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadingWidgets(true);

    const today = new Date().toISOString().split("T")[0];

    const [usersResult, rolesResult, deptsResult, jobsResult, notifResult, attendanceResult] = await Promise.allSettled([
      apiFetch<Employee[]>("/users"),
      apiFetch<Role[]>("/users/roles"),
      apiFetch<Department[]>("/users/departments"),
      apiFetch<JobSummary[]>("/jobs"),
      getHRInterviewNotifications(),
      apiFetch<TodayPunch[]>(`/timekeeping/timesheets?from=${today}&to=${today}`),
    ]);

    if (usersResult.status === "fulfilled") setEmployees(usersResult.value);
    else toast.error("Failed to load employees.");

    if (rolesResult.status === "fulfilled") setRoles(rolesResult.value);

    if (deptsResult.status === "fulfilled") setDepartments(Array.isArray(deptsResult.value) ? deptsResult.value : []);

    if (jobsResult.status === "fulfilled") setJobs(jobsResult.value);

    if (notifResult.status === "fulfilled") setNotifications(notifResult.value);

    if (attendanceResult.status === "fulfilled") {
      setTodayPunches(attendanceResult.value);
    } else {
      setAttendanceError(true);
    }

    setLoading(false);
    setLoadingWidgets(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Computed employee counts
  const activeCount   = employees.filter(e => e.account_status === "Active").length;
  const pendingCount  = employees.filter(e => e.account_status === "Pending").length;

  // Computed job stats
  const openJobs      = jobs.filter(j => j.status === "open");
  const totalPipeline = jobs.reduce((s, j) => s + (j.applicant_count ?? 0), 0);

  // Computed notification stats
  const pendingResponses = notifications.filter(n => !n.applicant_response).length;
  const rescheduleCount  = notifications.filter(n => n.applicant_response === "reschedule_requested").length;
  const alertCount       = pendingResponses + rescheduleCount;

  // Computed attendance
  const attendanceStats: AttendanceStats = computeTodayAttendance(todayPunches, employees);
  const attendanceRate = attendanceStats.rate;
  const attendanceColor = getAttendanceColor(attendanceRate);

  // Directory filter
  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchesSearch = (
      (e.first_name ?? "").toLowerCase().includes(q) ||
      (e.last_name ?? "").toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.employee_id ?? "").toLowerCase().includes(q)
    );
    const matchesStatus = statusFilter.size === 0 || statusFilter.has(e.account_status ?? "");
    return matchesSearch && matchesStatus;
  });

  const toggleStatus = (status: string) => {
    setStatusFilter(prev => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
    setPage(1);
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleDeactivate = async (employee: Employee) => {
    setConfirmDeact(null);
    try {
      await apiFetch(`/users/${employee.user_id}`, { method: "DELETE" });
      setEmployees(prev => prev.map(e =>
        e.user_id === employee.user_id ? { ...e, account_status: "Inactive" } : e
      ));
      toast.success(`${employee.first_name}'s account deactivated.`);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to deactivate account.");
    }
  };

  const handleReactivate = async (employee: Employee) => {
    try {
      await apiFetch(`/users/${employee.user_id}/reactivate`, { method: "PATCH" });
      setEmployees(prev => prev.map(e =>
        e.user_id === employee.user_id ? { ...e, account_status: "Active" } : e
      ));
      toast.success(`${employee.first_name}'s account reactivated.`);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to reactivate account.");
    }
  };

  const tableRowsPlaceholder = loading ? (
    <tr>
      <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
        Loading employees...
      </td>
    </tr>
  ) : (
    <tr>
      <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
        No employees found.
      </td>
    </tr>
  );
  const tableRows = loading || paged.length === 0 ? tableRowsPlaceholder : paged.map(e => (
    <tr key={e.user_id} className="hover:bg-primary/5 transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/10 shrink-0">
            {(e.first_name ?? "?").charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-foreground leading-none">
              {e.first_name} {e.last_name}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{e.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="font-mono text-xs text-muted-foreground">{e.employee_id}</span>
      </td>
      <td className="px-5 py-4">
        <span className="text-xs font-semibold text-foreground">
          {roles.find(r => r.role_id === e.role_id)?.role_name ?? "—"}
        </span>
      </td>
      <td className="px-5 py-4">
        <span className="text-xs text-muted-foreground">
          {departments.find(d => d.department_id === e.department_id)?.department_name ?? "—"}
        </span>
      </td>
      <td className="px-5 py-4">
        <StatusBadge status={e.account_status ?? ""} />
      </td>
      <td className="px-5 py-4 text-right">
        {e.user_id === currentUserId ? (
          <span className="text-[11px] text-muted-foreground italic px-2">You</span>
        ) : (
          <RowMenu
            employee={e}
            onDeactivate={() => setConfirmDeact(e)}
            onReactivate={() => handleReactivate(e)}
          />
        )}
      </td>
    </tr>
  ));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">HR Administration</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">HR Operations Overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Monitor recruitment, attendance, and workforce at a glance.
            </p>
            <div className="flex gap-3 mt-4">
              <Link href="/hr/jobs">
                <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 border border-white/20 hover:bg-white/20 transition-colors backdrop-blur">
                  <Briefcase className="h-4 w-4" /> + New Job Posting
                </button>
              </Link>
              <Link href="/hr/jobs">
                <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 border border-white/20 hover:bg-white/20 transition-colors backdrop-blur">
                  <ArrowRight className="h-4 w-4" /> View Pipeline
                </button>
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Current Scope</p>
            <p className="mt-1 text-lg font-bold">{employees.length} Users</p>
          </div>
        </div>
      </section>

      {/* ── 6-Stat Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Active Employees"
          value={activeCount}
          sub="Currently active"
          color="text-green-600"
          icon={Users}
        />
        <StatCard
          label="Pending Invites"
          value={pendingCount}
          sub="Awaiting activation"
          color="text-amber-500"
          icon={UserPlus}
        />
        <StatCard
          label="Open Positions"
          value={loadingWidgets ? "—" : openJobs.length}
          sub="Active job postings"
          color="text-blue-600"
          icon={Briefcase}
        />
        <StatCard
          label="Applications"
          value={loadingWidgets ? "—" : totalPipeline}
          sub="Total in pipeline"
          color="text-blue-500"
          icon={FileText}
        />
        <StatCard
          label="Attendance Today"
          value={loadingWidgets || attendanceError ? "—" : `${attendanceRate}%`}
          sub={attendanceError ? "Data unavailable" : `${attendanceStats.present} present`}
          color={attendanceColor}
          icon={CalendarCheck}
        />
        <StatCard
          label="Interview Alerts"
          value={loadingWidgets ? "—" : alertCount}
          sub={`${pendingResponses} pending · ${rescheduleCount} reschedule`}
          color={alertCount > 0 ? "text-violet-600" : "text-slate-500"}
          icon={Bell}
        />
      </div>

      {/* ── Two-column Mid Section ───────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-[2fr_3fr] items-start">

        {/* Open Positions Card */}
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] rounded-t-xl">
              <div>
                <h2 className="font-bold text-sm tracking-tight">Open Positions</h2>
                <p className="text-[11px] text-muted-foreground">{openJobs.length} active posting{openJobs.length === 1 ? "" : "s"}</p>
              </div>
              <Link href="/hr/jobs" className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="px-5 py-3 divide-y divide-border">
              <OpenPositionsContent loading={loadingWidgets} jobs={openJobs} />
            </div>
          </CardContent>
        </Card>

        {/* Interview Responses Feed */}
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] rounded-t-xl">
              <div className="flex items-center gap-2">
                <div>
                  <h2 className="font-bold text-sm tracking-tight">Interview Responses</h2>
                  <p className="text-[11px] text-muted-foreground">Applicant replies to scheduled interviews</p>
                </div>
                {alertCount > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                    {alertCount}
                  </span>
                )}
              </div>
              <Link href="/hr/jobs" className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="px-5 py-3 divide-y divide-border">
              <InterviewFeedContent loading={loadingWidgets} notifications={notifications} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Today's Attendance Card ──────────────────────────────────────────── */}
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-sm tracking-tight">Today&apos;s Attendance</h2>
              <p className="text-[11px] text-muted-foreground">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
            {!attendanceError && !loadingWidgets && (
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getAttendanceBarColor(attendanceRate)}`}
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
                <span className={`text-sm font-bold ${attendanceColor}`}>{attendanceRate}%</span>
              </div>
            )}
          </div>

          <AttendanceContent loading={loadingWidgets} error={attendanceError} stats={attendanceStats} />
        </CardContent>
      </Card>

      {/* ── Employee Directory ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border/70 rounded-2xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))]">
          <div>
            <h2 className="font-bold text-base tracking-tight">Employee Directory</h2>
            <p className="text-xs text-muted-foreground">Manage account status for your company</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 w-full sm:w-60"
              />
            </div>
            {/* Filter */}
            <div className="relative shrink-0" ref={filterRef}>
              <Button
                variant="outline" size="icon" className={`h-9 w-9 ${statusFilter.size > 0 ? "border-primary text-primary" : ""}`}
                onClick={() => setShowFilter(v => !v)}
              >
                <Filter className="h-4 w-4" />
                {statusFilter.size > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {statusFilter.size}
                  </span>
                )}
              </Button>
              {showFilter && (
                <div className="absolute right-0 top-10 z-50 w-44 bg-card border border-border rounded-lg shadow-lg py-1.5">
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</p>
                  {(["Active", "Inactive", "Pending"] as const).map(s => (
                    <button
                      key={s}
                      className="flex items-center justify-between px-3 py-2 w-full hover:bg-muted/50 text-sm text-foreground"
                      onClick={() => toggleStatus(s)}
                    >
                      <span>{s}</span>
                      {statusFilter.has(s) && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  ))}
                  {statusFilter.size > 0 && (
                    <>
                      <div className="border-t border-border my-1" />
                      <button
                        className="px-3 py-2 w-full text-left text-xs text-muted-foreground hover:bg-muted/50"
                        onClick={() => { setStatusFilter(new Set()); setPage(1); }}
                      >
                        Clear filters
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/40 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Employee ID</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tableRows}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {filtered.length > 0
              ? `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length}`
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
      </div>

      {/* Deactivate confirmation */}
      {confirmDeact && (
        <ConfirmDeactivate
          employee={confirmDeact}
          onClose={() => setConfirmDeact(null)}
          onConfirm={() => handleDeactivate(confirmDeact)}
        />
      )}
    </div>
  );
}
