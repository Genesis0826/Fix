"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserInfo, type StoredUser } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { authFetch, getEmployeeProfile, getMyEmployeeDocuments, type EmployeeDocument, type EmployeeProfile } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Landmark,
  Loader2,
  ShieldCheck,
  User,
  Timer,
  CalendarDays,
  TrendingUp,
  ChevronRight,
  Sparkles,
  CircleAlert,
  Upload,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MyStatus = {
  date: string;
  current_status: "time-in" | "time-out" | "absence" | null;
  time_in:  { timestamp: string } | null;
  time_out: { timestamp: string } | null;
};

const REQUIRED_DOC_TYPES = [
  { id: "government-id",       label: "Government ID",              icon: ShieldCheck },
  { id: "tax-form",            label: "Tax Form",                   icon: FileText    },
  { id: "employment-contract", label: "Employment Contract",        icon: FileCheck   },
  { id: "bank-details",        label: "Bank Details / Payroll Form",icon: Landmark    },
];

const PROFILE_FIELDS: { key: keyof EmployeeProfile; label: string }[] = [
  { key: "personal_email",    label: "Personal Email"  },
  { key: "date_of_birth",     label: "Date of Birth"   },
  { key: "nationality",       label: "Nationality"     },
  { key: "civil_status",      label: "Civil Status"    },
  { key: "complete_address",  label: "Home Address"    },
  { key: "bank_name",         label: "Bank Name"       },
  { key: "bank_account_number", label: "Account Number"},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTs(ts: string) {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

function fmtTime(ts: string | null | undefined) {
  if (!ts) return "—";
  return parseTs(ts).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila",
  });
}

function fmtHours(inTs: string | null | undefined, outTs: string | null | undefined) {
  if (!inTs || !outTs) return null;
  const diff = parseTs(outTs).getTime() - parseTs(inTs).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function calcProfilePct(profile: EmployeeProfile | null) {
  if (!profile) return 0;
  const filled = PROFILE_FIELDS.filter(({ key }) => !!profile[key]).length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href, icon: Icon, label, desc, color,
}: {
  href: string; icon: React.ElementType; label: string; desc: string; color: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </div>
    </Link>
  );
}

// ─── Setup step status chip ───────────────────────────────────────────────────

function StepChip({ done }: { done: boolean }) {
  return done ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-700">
      <CheckCircle2 className="h-3 w-3" /> Done
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
      <CircleAlert className="h-3 w-3" /> Pending
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmployeeDashboardPage() {
  const [user,       setUser]       = useState<StoredUser | null>(null);
  const [profile,    setProfile]    = useState<EmployeeProfile | null>(null);
  const [docs,       setDocs]       = useState<EmployeeDocument[]>([]);
  const [tkStatus,   setTkStatus]   = useState<MyStatus | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => { setUser(getUserInfo()); }, []);
  useWelcomeToast(user?.name || "Employee", "Staff Portal");

  useEffect(() => {
    Promise.all([
      getEmployeeProfile().catch(() => null),
      getMyEmployeeDocuments().catch(() => []),
      authFetch(`${API_BASE_URL}/timekeeping/my-status`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([p, d, tk]) => {
      setProfile(p);
      setDocs(d as EmployeeDocument[]);
      setTkStatus(tk);
    }).finally(() => setLoading(false));
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────────

  const profilePct       = calcProfilePct(profile);
  const profileDone      = profilePct >= 100;

  const approvedDocs     = docs.filter(d => d.status === "approved");
  const pendingDocs      = docs.filter(d => d.status === "pending");
  const rejectedDocs     = docs.filter(d => d.status === "rejected");
  const uploadedTypes    = new Set(docs.map(d => d.document_type));
  const missingDocs      = REQUIRED_DOC_TYPES.filter(r => !uploadedTypes.has(r.id));
  const allDocsDone      = missingDocs.length === 0 && rejectedDocs.length === 0;
  const docsPct          = Math.round((approvedDocs.length / REQUIRED_DOC_TYPES.length) * 100);

  const setupDone        = profileDone && allDocsDone;
  const overallSetupPct  = Math.round((profilePct + docsPct) / 2);

  const todayStatus      = tkStatus?.current_status ?? null;
  const timeIn           = tkStatus?.time_in?.timestamp ?? null;
  const timeOut          = tkStatus?.time_out?.timestamp ?? null;
  const hoursWorked      = fmtHours(timeIn, timeOut);

  // ── Status pill ─────────────────────────────────────────────────────────────

  const statusConfig: Record<string, { label: string; cls: string }> = {
    "time-in":  { label: "Clocked In",  cls: "bg-green-100 text-green-700 border-green-200"  },
    "time-out": { label: "Clocked Out", cls: "bg-blue-100 text-blue-700 border-blue-200"     },
    "absence":  { label: "On Leave",    cls: "bg-amber-100 text-amber-700 border-amber-200"  },
  };
  const todayCfg = todayStatus ? statusConfig[todayStatus] : null;

  // ── Missing profile fields ───────────────────────────────────────────────────
  const missingProfileFields = PROFILE_FIELDS.filter(({ key }) => !profile?.[key]).map(f => f.label);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-8 text-white shadow-sm md:px-8 md:py-10">
        <div className="absolute inset-y-0 right-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_65%)]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">Staff Portal</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              {loading ? "Loading…" : `Welcome back, ${profile?.first_name || user?.name?.split(" ")[0] || "Employee"}!`}
            </h1>
            <p className="mt-1.5 text-sm text-white/70">{getTodayLabel()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {loading ? (
              <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur w-36 h-16 animate-pulse" />
            ) : (
              <>
                <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Today</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-white/70" />
                    <p className="text-sm font-bold">
                      {todayCfg ? (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${todayCfg.cls}`}>
                          {todayCfg.label}
                        </span>
                      ) : (
                        <span className="text-white/60 text-xs">Not clocked in</span>
                      )}
                    </p>
                  </div>
                </div>
                {timeIn && (
                  <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Time In</p>
                    <p className="mt-1 text-sm font-bold">{fmtTime(timeIn)}</p>
                  </div>
                )}
                {hoursWorked && (
                  <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Hours Worked</p>
                    <p className="mt-1 text-sm font-bold">{hoursWorked}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Stat row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Today's Status"
          value={todayCfg?.label ?? (loading ? "—" : "Not In")}
          sub={timeIn ? `Time in: ${fmtTime(timeIn)}` : undefined}
          icon={Timer}
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Docs Approved"
          value={loading ? "—" : `${approvedDocs.length}/${REQUIRED_DOC_TYPES.length}`}
          sub={pendingDocs.length > 0 ? `${pendingDocs.length} pending review` : undefined}
          icon={FileCheck}
          color="bg-green-50 text-green-700"
        />
        <StatCard
          label="Profile Setup"
          value={loading ? "—" : `${profilePct}%`}
          sub={profileDone ? "All fields complete" : `${missingProfileFields.length} fields missing`}
          icon={User}
          color="bg-violet-50 text-violet-700"
        />
        <StatCard
          label="Start Date"
          value={loading ? "—" : (profile?.start_date
            ? new Date(profile.start_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "—")}
          sub={profile?.employee_id ? `ID: ${profile.employee_id}` : undefined}
          icon={CalendarDays}
          color="bg-amber-50 text-amber-700"
        />
      </div>

      {/* ── New Employee Setup Tracker (hidden when fully done) ──────────────── */}
      {!loading && !setupDone && (
        <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-primary/10">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center">
                  <Sparkles className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold tracking-tight text-gray-900">
                    Get Started — Employee Setup
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Complete your profile and upload your documents to finish setup.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-wide shrink-0">
                {overallSetupPct}% Complete
              </span>
            </div>
            <Progress value={overallSetupPct} className="mt-4 h-2" />
          </CardHeader>

          <CardContent className="p-5 grid sm:grid-cols-2 gap-4">

            {/* Step 1 — Profile */}
            <div className={`rounded-xl border p-4 space-y-3 ${profileDone ? "bg-white border-green-200" : "bg-white border-amber-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${profileDone ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Personal Information</p>
                    <p className="text-xs text-muted-foreground">Fill in your profile details</p>
                  </div>
                </div>
                <StepChip done={profileDone} />
              </div>

              {!profileDone && missingProfileFields.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Missing fields</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingProfileFields.map(f => (
                      <span key={f} className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-1">
                <Button size="sm" variant={profileDone ? "outline" : "default"} className="h-8 text-xs" asChild>
                  <Link href="/employee/profile">
                    {profileDone ? "View Profile" : "Complete Profile"}
                    <ArrowRight className="h-3 w-3 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Step 2 — Documents */}
            <div className={`rounded-xl border p-4 space-y-3 ${allDocsDone ? "bg-white border-green-200" : "bg-white border-amber-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${allDocsDone ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    <Upload className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Required Documents</p>
                    <p className="text-xs text-muted-foreground">Upload & get HR approval</p>
                  </div>
                </div>
                <StepChip done={allDocsDone} />
              </div>

              <div className="space-y-1.5">
                {REQUIRED_DOC_TYPES.map(({ id, label, icon: DocIcon }) => {
                  const doc = docs.find(d => d.document_type === id);
                  const statusColor =
                    !doc                       ? "text-gray-400"
                    : doc.status === "approved" ? "text-green-600"
                    : doc.status === "pending"  ? "text-amber-600"
                    :                            "text-red-600";
                  const statusLabel =
                    !doc                       ? "Not uploaded"
                    : doc.status === "approved" ? "Approved"
                    : doc.status === "pending"  ? "Pending review"
                    :                            "Rejected";
                  const dotColor =
                    !doc                       ? "bg-gray-300"
                    : doc.status === "approved" ? "bg-green-500"
                    : doc.status === "pending"  ? "bg-amber-500"
                    :                            "bg-red-500";

                  return (
                    <div key={id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <DocIcon className={`h-3.5 w-3.5 shrink-0 ${statusColor}`} />
                        <span className="text-gray-700 truncate">{label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                        <span className={`${statusColor} font-medium`}>{statusLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-1">
                <Button size="sm" variant={allDocsDone ? "outline" : "default"} className="h-8 text-xs" asChild>
                  <Link href="/employee/documents">
                    {allDocsDone ? "View Documents" : "Upload Documents"}
                    <ArrowRight className="h-3 w-3 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {/* ── All-done banner (shown once setup complete) ───────────────────────── */}
      {!loading && setupDone && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Account fully set up</p>
            <p className="text-xs text-green-700/80">Your profile is complete and all required documents have been approved.</p>
          </div>
        </div>
      )}

      {/* ── Bottom split: Timekeeping today + Quick Actions ──────────────────── */}
      <div className="grid gap-6 md:grid-cols-[1fr_1fr] items-start">

        {/* Timekeeping today */}
        <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-[linear-gradient(155deg,rgba(37,99,235,0.06),transparent)] border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Clock className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </div>
                <CardTitle className="text-base font-bold tracking-tight">Today&apos;s Timekeeping</CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" asChild>
                <Link href="/employee/timekeeping">View all <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {loading ? (
              <div className="space-y-2 animate-pulse">
                {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-muted/40" />)}
              </div>
            ) : (
              <>
                <TkRow label="Status" value={
                  todayCfg ? (
                    <Badge className={`border text-[10px] font-bold uppercase tracking-wide ${todayCfg.cls}`}>
                      {todayCfg.label}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No record yet</span>
                  )
                } />
                <TkRow label="Time In"  value={<span className="text-sm font-semibold">{fmtTime(timeIn)}</span>} />
                <TkRow label="Time Out" value={<span className="text-sm font-semibold">{fmtTime(timeOut)}</span>} />
                {hoursWorked && (
                  <TkRow label="Hours Worked" value={
                    <span className="text-sm font-semibold text-primary">{hoursWorked}</span>
                  } />
                )}
                {!todayStatus && (
                  <div className="pt-1">
                    <Button size="sm" className="w-full h-9 text-xs" asChild>
                      <Link href="/employee/timekeeping">
                        <Timer className="h-3.5 w-3.5 mr-2" /> Go to Timekeeping
                      </Link>
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-[linear-gradient(155deg,rgba(37,99,235,0.06),transparent)] border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 text-violet-700 rounded-lg">
                <TrendingUp className="h-[18px] w-[18px]" />
              </div>
              <CardTitle className="text-base font-bold tracking-tight">Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <QuickAction
              href="/employee/timekeeping"
              icon={Clock}
              label="Timekeeping"
              desc="Clock in/out and view your timesheet"
              color="bg-blue-100 text-blue-700"
            />
            <QuickAction
              href="/employee/documents"
              icon={FileCheck}
              label="My Documents"
              desc={`${approvedDocs.length} approved · ${pendingDocs.length} pending`}
              color="bg-green-100 text-green-700"
            />
            <QuickAction
              href="/employee/profile"
              icon={User}
              label="My Profile"
              desc={profileDone ? "Profile complete" : `${missingProfileFields.length} fields to fill in`}
              color="bg-violet-100 text-violet-700"
            />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

// ─── Helper component ─────────────────────────────────────────────────────────

function TkRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div>{value}</div>
    </div>
  );
}
