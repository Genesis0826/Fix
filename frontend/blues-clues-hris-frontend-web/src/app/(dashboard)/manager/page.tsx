"use client";

import Link from "next/link";
import { useEffect, useCallback, useState } from "react";
import {
  ArrowRight,
  Clock,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/authApi";
import { getUserInfo, getAccessToken, parseJwt } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  user_id: string;
  account_status: string | null;
};

type TodayPunch = {
  employee_id: string;
  log_type: string;
  clock_type?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
}: Readonly<{ label: string; value: number | string; sub: string; color: string; icon: LucideIcon }>) {
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

function QuickLink({
  href, icon: Icon, title, description,
}: Readonly<{ href: string; icon: LucideIcon; title: string; description: string }>) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3.5 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManagerDashboardPage() {
  const user = getUserInfo();
  const currentUserId = parseJwt(getAccessToken() ?? "")?.sub_userid as string | undefined;
  const userName = user?.name || "Manager";
  useWelcomeToast(userName, "Management Portal");

  const [employees, setEmployees]         = useState<Employee[]>([]);
  const [todayPunches, setTodayPunches]   = useState<TodayPunch[]>([]);
  const [loading, setLoading]             = useState(true);
  const [attendanceError, setAttendanceError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const [usersResult, attendanceResult] = await Promise.allSettled([
      authFetch(`${API_BASE_URL}/users`).then(r => r.json()) as Promise<Employee[]>,
      authFetch(`${API_BASE_URL}/timekeeping/timesheets?from=${today}&to=${today}`).then(r => r.json()) as Promise<TodayPunch[]>,
    ]);

    if (usersResult.status === "fulfilled") {
      const all = Array.isArray(usersResult.value) ? usersResult.value : [];
      setEmployees(all.filter(e => e.user_id !== currentUserId));
    }

    if (attendanceResult.status === "fulfilled" && Array.isArray(attendanceResult.value)) {
      setTodayPunches(attendanceResult.value);
    } else {
      setAttendanceError(true);
    }

    setLoading(false);
  }, [currentUserId]);

  useEffect(() => { load(); }, [load]);

  // Employee counts
  const activeCount   = employees.filter(e => e.account_status === "Active").length;
  const pendingCount  = employees.filter(e => e.account_status === "Pending").length;
  const inactiveCount = employees.filter(e => e.account_status === "Inactive").length;

  // Attendance rate
  const activeEmployees = employees.filter(e => e.account_status === "Active");
  const presentSet = new Set(
    todayPunches.filter(p => p.log_type === "time-in").map(p => p.employee_id)
  );
  const presentCount = activeEmployees.filter(e => presentSet.has(e.user_id)).length;
  const attendanceRate = activeEmployees.length > 0
    ? Math.round((presentCount / activeEmployees.length) * 100)
    : 0;
  const attendanceColor = getAttendanceColor(attendanceRate);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Management Portal</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Team Overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Monitor your team&apos;s attendance, manage direct reports, and track workforce activity.
            </p>
            <div className="flex gap-3 mt-4">
              <Link href="/manager/team">
                <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 border border-white/20 hover:bg-white/20 transition-colors backdrop-blur">
                  <Users className="h-4 w-4" /> Manage Team
                </button>
              </Link>
              <Link href="/manager/timekeeping">
                <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 border border-white/20 hover:bg-white/20 transition-colors backdrop-blur">
                  <Clock className="h-4 w-4" /> Timekeeping
                </button>
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Team Size</p>
            <p className="mt-1 text-lg font-bold">{loading ? "—" : employees.length}</p>
          </div>
        </div>
      </section>

      {/* ── Stat Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Team Members"
          value={loading ? "—" : employees.length}
          sub="Total in company"
          color="text-foreground"
          icon={Users}
        />
        <StatCard
          label="Active"
          value={loading ? "—" : activeCount}
          sub="Currently active"
          color="text-green-600"
          icon={UserCheck}
        />
        <StatCard
          label="Pending"
          value={loading ? "—" : pendingCount}
          sub="Awaiting activation"
          color="text-amber-500"
          icon={UserPlus}
        />
        <StatCard
          label="Inactive"
          value={loading ? "—" : inactiveCount}
          sub="Deactivated accounts"
          color="text-red-500"
          icon={UserX}
        />
        <StatCard
          label="Attendance Today"
          value={loading || attendanceError ? "—" : `${attendanceRate}%`}
          sub={attendanceError ? "Data unavailable" : `${presentCount} of ${activeCount} present`}
          color={attendanceColor}
          icon={CalendarCheck}
        />
      </div>

      {/* ── Attendance Bar ───────────────────────────────────────────────────── */}
      {!attendanceError && !loading && activeCount > 0 && (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Today&apos;s Attendance</p>
              <span className={`text-sm font-bold ${attendanceColor}`}>{attendanceRate}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getAttendanceBarColor(attendanceRate)}`}
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {presentCount} present · {activeCount - presentCount} not yet clocked in
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Links ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] px-5 py-4">
          <h2 className="text-base font-bold tracking-tight">Management Tools</h2>
          <p className="text-xs text-muted-foreground">Quick access to your daily operations</p>
        </div>
        <div className="p-5 grid gap-3 sm:grid-cols-2">
          <QuickLink
            href="/manager/team"
            icon={Users}
            title="Team Members"
            description="View profiles, account status, and direct reports"
          />
          <QuickLink
            href="/manager/timekeeping"
            icon={Clock}
            title="Team Timekeeping"
            description="Monitor attendance and worked hours"
          />
        </div>
      </div>
    </div>
  );
}
