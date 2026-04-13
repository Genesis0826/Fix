"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserInfo } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { getSubscriptions, type Subscription } from "@/lib/adminApi";
import {
  Users, Building2, Mail, Clock,
  UserPlus, CreditCard, Settings, ChevronRight,
  RefreshCw, ScrollText, Briefcase, ClipboardList,
  Shield, Activity, UserCheck, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditLog = {
  log_id: string;
  action: string;
  performed_by: string;
  target_user_id: string | null;
  timestamp: string;
};

function getActionMeta(action: string): { icon: any; bg: string; text: string } {
  const l = action.toLowerCase();
  if (l.includes("job posting"))  return { icon: Briefcase,     bg: "bg-blue-50",   text: "text-blue-600"   };
  if (l.includes("application"))  return { icon: ClipboardList, bg: "bg-purple-50", text: "text-purple-600" };
  if (l.includes("user") || l.includes("invite") || l.includes("account"))
                                   return { icon: UserCheck,     bg: "bg-green-50",  text: "text-green-600"  };
  if (l.includes("role"))          return { icon: Shield,        bg: "bg-amber-50",  text: "text-amber-600"  };
  return                                  { icon: Activity,      bg: "bg-muted",     text: "text-muted-foreground" };
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Employee = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  account_status: "Active" | "Inactive" | "Pending";
  invite_expires_at: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatExpiry(iso: string | null): string {
  if (!iso) return "No expiry set";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function countdown(iso: string | null): { label: string; urgent: boolean; expired: boolean } {
  if (!iso) return { label: "No active invite", urgent: false, expired: false };
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "Expired", urgent: true, expired: true };
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) return { label: `${days}d ${hours}h`, urgent: days <= 1, expired: false };
  if (hours > 0) return { label: `${hours}h ${mins}m`, urgent: true, expired: false };
  return { label: `${mins}m`, urgent: true, expired: false };
}

function nextExpiry(pending: Employee[]): { label: string; name: string } {
  const withExpiry = pending
    .filter(u => u.invite_expires_at)
    .sort((a, b) => new Date(a.invite_expires_at!).getTime() - new Date(b.invite_expires_at!).getTime());

  if (!withExpiry.length) return { label: "—", name: "No pending invites" };
  const first = withExpiry[0];
  const { label } = countdown(first.invite_expires_at);
  return { label, name: `${first.first_name} ${first.last_name}` };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const user      = getUserInfo();
  const adminName = user?.name || "Admin";

  const [employees, setEmployees]         = useState<Employee[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [totalUsers, setTotalUsers]       = useState<number>(0);
  const [loading, setLoading]             = useState(true);
  const [resendingId, setResendingId]     = useState<string | null>(null);
  const [auditLogs, setAuditLogs]         = useState<AuditLog[]>([]);

  useWelcomeToast(adminName, "System Administration");

  useEffect(() => {
    Promise.all([
      authFetch(`${API_BASE_URL}/users/stats`).then(r => r.json()),
      authFetch(`${API_BASE_URL}/users`).then(r => r.json()),
      getSubscriptions().catch(() => [] as Subscription[]),
      authFetch(`${API_BASE_URL}/audit/logs?limit=8`).then(r => r.json()).catch(() => []),
    ]).then(([stats, users, subs, logs]) => {
      setTotalUsers(stats?.total ?? 0);
      setEmployees(Array.isArray(users) ? users : []);
      setSubscriptions(Array.isArray(subs) ? subs : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
    }).finally(() => setLoading(false));
  }, []);

  async function handleResendInvite(emp: Employee) {
    setResendingId(emp.user_id);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/${emp.user_id}/resend-invite`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to resend invite.");
      setEmployees(prev => prev.map(e =>
        e.user_id === emp.user_id ? { ...e, invite_expires_at: data.invite_expires_at } : e
      ));
      toast.success(`Invite resent to ${emp.email}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend invite.");
    } finally {
      setResendingId(null);
    }
  }

  const pending  = employees.filter(e => e.account_status === "Pending");
  const inactive = employees.filter(e => e.account_status === "Inactive");
  const companies = subscriptions.length;
  const expiry   = nextExpiry(pending);

  // Attention queue: sort by soonest expiry, those without expiry go last
  const attentionQueue = [...pending].sort((a, b) => {
    if (!a.invite_expires_at && !b.invite_expires_at) return 0;
    if (!a.invite_expires_at) return 1;
    if (!b.invite_expires_at) return -1;
    return new Date(a.invite_expires_at).getTime() - new Date(b.invite_expires_at).getTime();
  });

  const attentionQueueEmpty = loading ? (
    <p className="px-6 py-8 text-center text-sm text-muted-foreground">Loading...</p>
  ) : (
    <p className="px-6 py-8 text-center text-sm text-muted-foreground">No pending invitations. All caught up!</p>
  );
  const attentionQueueContent = loading || attentionQueue.length === 0 ? attentionQueueEmpty : attentionQueue.map(u => {
    const cd = countdown(u.invite_expires_at);
    return (
      <div key={u.user_id} className="px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-foreground">
                {u.first_name} {u.last_name}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
            {u.invite_expires_at && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Expires on {formatExpiry(u.invite_expires_at)}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
            {u.invite_expires_at && !cd.expired ? (
              <>
                <p className={`text-sm font-bold ${cd.urgent ? "text-red-500" : "text-amber-600"}`}>
                  {cd.label}
                </p>
                <p className="text-[10px] text-muted-foreground">Remaining before expiry</p>
              </>
            ) : (
              <>
                <p className={`text-xs font-bold ${cd.expired ? "text-red-500" : "text-muted-foreground"}`}>
                  {cd.expired ? "Expired" : "No active invite"}
                </p>
                <button
                  onClick={() => handleResendInvite(u)}
                  disabled={resendingId === u.user_id}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${resendingId === u.user_id ? "animate-spin" : ""}`} />
                  {resendingId === u.user_id ? "Sending..." : "Resend Invite"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  });

  const auditLogsEmpty = loading ? (
    <p className="px-6 py-8 text-center text-sm text-muted-foreground">Loading activity…</p>
  ) : (
    <p className="px-6 py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
  );
  const auditLogsContent = loading || auditLogs.length === 0 ? auditLogsEmpty : (
    <div className="divide-y divide-border">
      {auditLogs.map((log) => {
        const meta = getActionMeta(log.action);
        const Icon = meta.icon;
        return (
          <div key={log.log_id} className="flex items-start gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors">
            <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${meta.bg}`}>
              <Icon className={`h-3.5 w-3.5 ${meta.text}`} />
            </div>
            <p className="flex-1 text-sm text-foreground leading-snug line-clamp-1 min-w-0">
              {log.action}
            </p>
            <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
              {relativeTime(log.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Hero card */}
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-7 py-8 text-white shadow-sm">
        <div className="absolute inset-y-0 right-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="relative z-10">
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] border border-white/20 bg-white/10 text-white/80 rounded-full px-3 py-1 mb-4">
            Platform Overview
          </span>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold leading-snug max-w-xl">
                Welcome back, <span className="text-emerald-300">{adminName}</span>. Your control panel is ready.
              </h1>
              <p className="mt-3 text-sm text-white/65 max-w-xl">
                Monitor platform health, manage users, and handle administrative tasks from one place.
              </p>
            </div>
            <div className="flex items-stretch gap-3 shrink-0">
              {[
                { label: "Users",    value: totalUsers },
                { label: "Pending",  value: pending.length },
                { label: "Inactive", value: inactive.length },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/8 px-5 py-3 min-w-18 backdrop-blur">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">{label}</p>
                  <p className="text-2xl font-bold">{loading ? "—" : value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: Users,
            iconBg: "bg-blue-100 text-blue-600",
            border: "border-border",
            label: "Total Users",
            value: loading ? "—" : String(totalUsers),
            sub: "All users across tenants",
            valueColor: "text-foreground",
          },
          {
            icon: Building2,
            iconBg: "bg-emerald-100 text-emerald-600",
            border: "border-border",
            label: "Companies",
            value: loading ? "—" : String(companies),
            sub: "Organizations onboarded",
            valueColor: "text-foreground",
          },
          {
            icon: Mail,
            iconBg: "bg-amber-100 text-amber-600",
            border: pending.length > 0 ? "border-amber-200" : "border-border",
            label: "Pending Invites",
            value: loading ? "—" : String(pending.length),
            sub: "Awaiting activation",
            valueColor: pending.length > 0 ? "text-amber-600" : "text-foreground",
          },
          {
            icon: Clock,
            iconBg: "bg-red-100 text-red-500",
            border: expiry.label === "—" ? "border-border" : "border-red-200",
            label: "Next Expiry",
            value: loading ? "—" : expiry.label,
            sub: expiry.name,
            valueColor: "text-red-500",
          },
        ].map(({ icon: Icon, iconBg, border, label, value, sub, valueColor }) => (
          <div key={label} className={`bg-card border ${border} rounded-xl p-5 shadow-sm`}>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
          </div>
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid md:grid-cols-[1fr_360px] gap-6 items-start">

        {/* Attention Queue */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <h2 className="font-bold text-base">Attention Queue</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Pending invites sorted by the soonest expiry deadline.</p>
            </div>
            {pending.length > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0 mt-0.5">
                {pending.length} pending
              </span>
            )}
          </div>

          <div className="divide-y divide-border">
            {attentionQueueContent}
          </div>

          {attentionQueue.length > 0 && (
            <div className="px-6 py-3 border-t border-border bg-muted/10">
              <Link href="/system-admin/users" className="text-xs text-primary font-semibold hover:underline">
                Manage all users →
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="font-bold text-base">Quick Actions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Jump directly to what matters most.</p>
          </div>
          <div className="divide-y divide-border">
            {[
              {
                href: "/system-admin/users",
                icon: UserPlus,
                accent: "border-l-blue-500 group-hover:bg-blue-50/50",
                iconBg: "bg-blue-50 text-blue-600",
                label: "User Management",
                sub: "Create, edit, move, and deactivate accounts.",
              },
              {
                href: "/system-admin/subscriptions",
                icon: CreditCard,
                accent: "border-l-emerald-500 group-hover:bg-emerald-50/50",
                iconBg: "bg-emerald-50 text-emerald-600",
                label: "Subscriptions",
                sub: "Review plans, renewals, and tenant billing.",
              },
              {
                href: "/system-admin/timekeeping",
                icon: Clock,
                accent: "border-l-violet-500 group-hover:bg-violet-50/50",
                iconBg: "bg-violet-50 text-violet-600",
                label: "Timekeeping",
                sub: "Company-wide attendance and compliance.",
              },
              {
                href: "/system-admin/audit-logs",
                icon: ScrollText,
                accent: "border-l-slate-500 group-hover:bg-slate-50/50",
                iconBg: "bg-slate-100 text-slate-600",
                label: "Audit Logs",
                sub: "Full history of every admin action.",
              },
              {
                href: "/system-admin/settings",
                icon: Settings,
                accent: "border-l-amber-500 group-hover:bg-amber-50/50",
                iconBg: "bg-amber-50 text-amber-600",
                label: "Global Settings",
                sub: "Configure lifecycle permissions per role.",
              },
            ].map(({ href, icon: Icon, accent, iconBg, label, sub }) => (
              <Link key={href} href={href} className={`flex items-start gap-4 pl-5 pr-6 py-3.5 border-l-[3px] border-l-transparent transition-all group ${accent}`}>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${iconBg}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-1 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <ScrollText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-base">Recent Activity</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest system-wide actions across all tenants.</p>
            </div>
          </div>
          <Link
            href="/system-admin/audit-logs"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline shrink-0"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {auditLogsContent}

        <div className="px-6 py-3 border-t border-border bg-muted/10">
          <Link href="/system-admin/audit-logs" className="text-xs text-primary font-semibold hover:underline">
            Open full audit log →
          </Link>
        </div>
      </div>

    </div>
  );
}
