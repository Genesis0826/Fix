"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getAccessToken, parseJwt } from "@/lib/authStorage";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, MoreHorizontal, X,
  ChevronLeft, ChevronRight, UserX, UserCheck,
  Filter, Download, Check, Mail, Eye,
  Hash, User, Building2, Calendar, Shield, TrendingUp, AtSign,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Role {
  role_id: string;
  role_name: string;
}

interface Department {
  department_id: string;
  department_name: string;
}

interface Employee {
  user_id: string;
  employee_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  company_id: string | null;
  role_id: string | null;
  department_id: string | null;
  start_date: string | null;
  account_status: "Active" | "Inactive" | "Pending";
  last_login: string | null;
  invite_expires_at: string | null;
}

interface Stats {
  total: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 8;

const STATUS_STYLES: Record<string, string> = {
  Active:   "bg-green-100 text-green-700 border-green-200",
  Inactive: "bg-red-100 text-red-700 border-red-200",
  Pending:  "bg-amber-100 text-amber-700 border-amber-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as Record<string, unknown>)?.message as string || "Request failed");
  return data as T;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { readonly label: string; readonly value: number; readonly sub: string; readonly color: string }) {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { readonly status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${style}`}>
      {status}
    </span>
  );
}

function formatLastLogin(value: string | null) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatInviteDeadline(value: string | null) {
  if (!value) return "No active invite";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatInviteCountdown(expiresAt: string | null, now: number) {
  if (!expiresAt) return "No active invite";
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return "Unknown";
  const diff = expiry - now;
  if (diff <= 0) return "Expired";
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Row action dropdown
function MenuRow({ icon: Icon, label, onClick, color }: {
  readonly icon: React.ElementType; readonly label: string; readonly onClick: () => void; readonly color?: string;
}) {
  return (
    <button
      className={`flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-sm ${color ?? "text-foreground"}`}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function RowMenu({
  employee,
  onView,
  onDeactivate,
  onReactivate,
  onResendInvite,
  onAssignEmail,
}: {
  readonly employee: Employee;
  readonly onView: () => void;
  readonly onDeactivate: () => void;
  readonly onReactivate: () => void;
  readonly onResendInvite: () => void;
  readonly onAssignEmail: () => void;
}) {
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

  const close = (fn: () => void) => () => { fn(); setOpen(false); };

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
          className="fixed z-50 w-48 bg-card border border-border rounded-lg shadow-lg py-1 text-sm"
        >
          <MenuRow icon={Eye} label="View Profile" onClick={close(onView)} />
          {employee.account_status === "Pending" && (
            <MenuRow icon={Mail} label="Resend Invite" onClick={close(onResendInvite)} color="text-blue-600" />
          )}
          {employee.account_status !== "Inactive" && (
            <MenuRow icon={AtSign} label="Assign Company Email" onClick={close(onAssignEmail)} color="text-violet-600" />
          )}
          <div className="border-t border-border my-1" />
          {employee.account_status === "Inactive" ? (
            <MenuRow icon={UserCheck} label="Reactivate"  onClick={close(onReactivate)}  color="text-green-600" />
          ) : (
            <MenuRow icon={UserX}    label="Deactivate"  onClick={close(onDeactivate)}  color="text-red-600" />
          )}
        </div>
      )}
    </div>
  );
}

// Assign Company Email modal
function AssignEmailModal({
  employee,
  onClose,
  onSaved,
}: {
  readonly employee: Employee;
  readonly onClose: () => void;
  readonly onSaved: (newEmail: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/users/${employee.user_id}/assign-email`, {
        method: "PATCH",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      onSaved(email.trim().toLowerCase());
      toast.success(`Company email assigned. ${employee.first_name} must log in with their new email.`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign company email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">Assign Company Email</h2>
            <p className="text-xs text-muted-foreground">
              {employee.first_name} {employee.last_name} · {employee.email}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            The employee currently logs in with their personal email. Once you assign a company email, their login email will change and their existing sessions will be revoked.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="assign-email-input" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Company Email *
            </label>
            <Input
              id="assign-email-input"
              type="email"
              placeholder="firstname.lastname@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || !email.trim()}>
            {loading ? "Assigning..." : "Assign Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// View Profile sheet (right-side slide-in)
function ProfileField({ icon: Icon, label, value }: {
  readonly icon: React.ElementType; readonly label: string; readonly value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="p-1.5 rounded-md bg-muted text-muted-foreground mt-0.5 shrink-0">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{value || "—"}</p>
      </div>
    </div>
  );
}

function ViewProfileSheet({
  employee,
  roles,
  departments,
  onClose,
}: {
  readonly employee: Employee;
  readonly roles: Role[];
  readonly departments: Department[];
  readonly onClose: () => void;
}) {
  const roleName = roles.find(r => r.role_id === employee.role_id)?.role_name ?? "—";
  const deptName = departments.find(d => d.department_id === employee.department_id)?.department_name ?? "—";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative bg-card w-full max-w-sm h-full shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">Employee Profile</h2>
            <p className="text-xs text-muted-foreground">{employee.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 px-6 py-6 overflow-y-auto">
          {/* Avatar + name */}
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl border border-primary/20 shrink-0">
              {employee.first_name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">{employee.first_name} {employee.last_name}</p>
              <StatusBadge status={employee.account_status} />
            </div>
          </div>

          {/* Fields */}
          <ProfileField icon={Hash}      label="Employee ID" value={employee.employee_id} />
          <ProfileField icon={User}      label="Username"    value={employee.username} />
          <ProfileField icon={Shield}    label="Role"        value={roleName} />
          <ProfileField icon={Building2} label="Department"  value={deptName} />
          <ProfileField icon={Calendar}  label="Start Date"  value={formatDate(employee.start_date)} />
          <ProfileField icon={Calendar}  label="Last Login"  value={formatLastLogin(employee.last_login)} />

          {employee.account_status === "Pending" && employee.invite_expires_at && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-0.5">Invite Expiry</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{formatInviteDeadline(employee.invite_expires_at)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Edit Employee modal (centered)
function EditEmployeeModal({
  employee,
  roles,
  departments,
  onClose,
  onSaved,
}: {
  readonly employee: Employee;
  readonly roles: Role[];
  readonly departments: Department[];
  readonly onClose: () => void;
  readonly onSaved: (updated: Employee) => void;
}) {
  const [form, setForm] = useState({
    first_name: employee.first_name,
    last_name: employee.last_name,
    role_id: employee.role_id ?? "",
    department_id: employee.department_id ?? "",
    start_date: employee.start_date ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.role_id) e.role_id = "Required";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await apiFetch(`/users/${employee.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          role_id: form.role_id || null,
          department_id: form.department_id || null,
          start_date: form.start_date || null,
        }),
      });
      onSaved({
        ...employee,
        first_name: form.first_name,
        last_name: form.last_name,
        role_id: form.role_id || null,
        department_id: form.department_id || null,
        start_date: form.start_date || null,
      });
      toast.success("Employee updated.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update employee.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">Edit Employee</h2>
            <p className="text-xs text-muted-foreground">
              {employee.first_name} {employee.last_name} · {employee.employee_id}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="team-edit-first-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
              <Input
                id="team-edit-first-name"
                value={form.first_name}
                onChange={e => set("first_name", e.target.value)}
                className={errors.first_name ? "border-red-400 focus-visible:ring-red-300" : ""}
              />
              {errors.first_name && <p className="text-xs text-red-500">{errors.first_name}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="team-edit-last-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Last Name</label>
              <Input
                id="team-edit-last-name"
                value={form.last_name}
                onChange={e => set("last_name", e.target.value)}
                className={errors.last_name ? "border-red-400 focus-visible:ring-red-300" : ""}
              />
              {errors.last_name && <p className="text-xs text-red-500">{errors.last_name}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="team-edit-role" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Role</label>
            <select
              id="team-edit-role"
              value={form.role_id}
              onChange={e => set("role_id", e.target.value)}
              className={`w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                errors.role_id ? "border-red-400" : "border-input"
              }`}
            >
              <option value="">Select role...</option>
              {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
            </select>
            {errors.role_id && <p className="text-xs text-red-500">{errors.role_id}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="team-edit-department" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Department</label>
            <select
              id="team-edit-department"
              value={form.department_id}
              onChange={e => set("department_id", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select department...</option>
              {departments.length === 0 && <option value="" disabled>No departments available</option>}
              {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="team-edit-start-date" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Start Date</label>
            <Input id="team-edit-start-date" type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Deactivate confirmation dialog
function ConfirmDeactivate({
  employee,
  onClose,
  onConfirm,
}: {
  readonly employee: Employee;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
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
          Are you sure you want to deactivate{" "}
          <span className="font-semibold text-foreground">{employee.first_name} {employee.last_name}</span>?
          They will be logged out and unable to sign in.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>Deactivate</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManagerTeamPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUserId = parseJwt(getAccessToken() ?? "")?.sub_userid as string | undefined;

  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [roles, setRoles]             = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [onboardingMap, setOnboardingMap] = useState<Record<string, { progress_percentage: number; status: string }>>({});
  const [loading, setLoading]         = useState(true);
  const [now, setNow]                 = useState(() => Date.now());
  const [search, setSearch]           = useState(searchParams.get("q") ?? "");
  const [page, setPage]               = useState(1);

  // Sync URL ?q= → local search state
  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  const [viewEmployee, setViewEmployee]       = useState<Employee | null>(null);
  const [confirmDeact, setConfirmDeact]       = useState<Employee | null>(null);
  const [assignEmailEmployee, setAssignEmailEmployee] = useState<Employee | null>(null);
  const [showFilter, setShowFilter]       = useState(false);
  const [statusFilter, setStatusFilter]   = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter]       = useState("");
  const filterRef                         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(Date.now()), 1000);
    return () => globalThis.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, statsData, rolesData] = await Promise.all([
        apiFetch<Employee[]>("/users"),
        apiFetch<Stats>("/users/stats"),
        apiFetch<Role[]>("/users/roles"),
      ]);
      setEmployees(users.filter(u => u.user_id !== currentUserId));
      setStats(statsData);
      setRoles(rolesData);
      try {
        const deptsData = await apiFetch<Department[] | null>("/users/departments");
        setDepartments(Array.isArray(deptsData) ? deptsData : []);
      } catch {
        setDepartments([]);
      }
      try {
        const sessions = await apiFetch<Array<{ account_id: string; progress_percentage: number; status: string }>>("/onboarding/hr/sessions");
        const map: Record<string, { progress_percentage: number; status: string }> = {};
        for (const s of sessions) {
          map[s.account_id] = { progress_percentage: s.progress_percentage ?? 0, status: s.status ?? '' };
        }
        setOnboardingMap(map);
      } catch {
        setOnboardingMap({});
      }
    } catch {
      toast.error("Failed to load team data.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => { load(); }, [load]);

  const departmentNameById = (id: string | null) => {
    if (!id) return "—";
    return departments.find(d => d.department_id === id)?.department_name ?? id;
  };

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchesSearch =
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employee_id.toLowerCase().includes(q);
    const matchesStatus = statusFilter.size === 0 || statusFilter.has(e.account_status);
    const matchesDept = !deptFilter || e.department_id === deptFilter;
    return matchesSearch && matchesStatus && matchesDept;
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

  const activeCount   = employees.filter(e => e.account_status === "Active").length;
  const pendingCount  = employees.filter(e => e.account_status === "Pending").length;
  const inactiveCount = employees.filter(e => e.account_status === "Inactive").length;

  const handleResendInvite = async (employee: Employee) => {
    try {
      const res = await apiFetch<{ message: string; invite_expires_at: string }>(
        `/users/${employee.user_id}/resend-invite`, { method: "PATCH" }
      );
      setEmployees(prev => prev.map(e =>
        e.user_id === employee.user_id ? { ...e, invite_expires_at: res.invite_expires_at } : e
      ));
      toast.success(`Invite resent to ${employee.email}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend invite.");
    }
  };

  const handleDeactivate = async (employee: Employee) => {
    setConfirmDeact(null);
    try {
      await apiFetch(`/users/${employee.user_id}`, { method: "DELETE" });
      setEmployees(prev => prev.map(e =>
        e.user_id === employee.user_id ? { ...e, account_status: "Inactive" } : e
      ));
      toast.success(`${employee.first_name}'s account deactivated.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to deactivate account.");
    }
  };

  const handleReactivate = async (employee: Employee) => {
    try {
      const res = await apiFetch<{ message?: string }>(
        `/users/${employee.user_id}/reactivate`, { method: "PATCH" }
      );
      const nextStatus = res.message?.includes("Pending") ? "Pending" : "Active";
      setEmployees(prev => prev.map(e =>
        e.user_id === employee.user_id ? { ...e, account_status: nextStatus } : e
      ));
      toast.success(`${employee.first_name}'s account reactivated as ${nextStatus.toLowerCase()}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to reactivate account.");
    }
  };

  return (
    <div className="space-y-6">

      {/* Welcome card */}
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Team Management</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">My Team</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              View and manage your team members, handle account status, and track direct reports.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Total Members</p>
            <p className="mt-1 text-lg font-bold">{stats?.total ?? "—"}</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Members" value={stats?.total ?? 0}  sub="All accounts"         color="text-foreground" />
        <StatCard label="Active"        value={activeCount}         sub="Currently active"     color="text-green-600" />
        <StatCard label="Pending"       value={pendingCount}        sub="Awaiting activation"  color="text-amber-600" />
        <StatCard label="Inactive"      value={inactiveCount}       sub="Deactivated accounts" color="text-red-600" />
      </div>

      {/* Table Card */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-base">Team Members</h2>
            <p className="text-xs text-muted-foreground">Manage the accounts of your direct reports</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={e => {
                  const v = e.target.value;
                  setSearch(v); setPage(1);
                  const params = new URLSearchParams(searchParams.toString());
                  if (v) params.set("q", v); else params.delete("q");
                  router.replace(`${pathname}?${params.toString()}`, { scroll: false } as any);
                }}
                className="pl-9 h-9 w-full sm:w-60"
              />
            </div>
            <div className="relative shrink-0" ref={filterRef}>
              <Button
                variant="outline" size="icon"
                className={`h-9 w-9 ${(statusFilter.size > 0 || deptFilter) ? "border-primary text-primary" : ""}`}
                onClick={() => setShowFilter(v => !v)}
              >
                <Filter className="h-4 w-4" />
                {(statusFilter.size > 0 || deptFilter) && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {statusFilter.size + (deptFilter ? 1 : 0)}
                  </span>
                )}
              </Button>
              {showFilter && (
                <div className="absolute right-0 top-10 z-50 w-52 bg-card border border-border rounded-lg shadow-lg py-1.5">
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
                  {departments.length > 0 && (
                    <>
                      <div className="border-t border-border my-1" />
                      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Department</p>
                      <button
                        className="flex items-center justify-between px-3 py-2 w-full hover:bg-muted/50 text-sm text-foreground"
                        onClick={() => { setDeptFilter(""); setPage(1); }}
                      >
                        <span>All departments</span>
                        {!deptFilter && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                      {departments.map(d => (
                        <button
                          key={d.department_id}
                          className="flex items-center justify-between px-3 py-2 w-full hover:bg-muted/50 text-sm text-foreground"
                          onClick={() => { setDeptFilter(d.department_id); setPage(1); }}
                        >
                          <span className="truncate mr-2">{d.department_name}</span>
                          {deptFilter === d.department_id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      ))}
                    </>
                  )}
                  {(statusFilter.size > 0 || deptFilter) && (
                    <>
                      <div className="border-t border-border my-1" />
                      <button
                        className="px-3 py-2 w-full text-left text-xs text-muted-foreground hover:bg-muted/50"
                        onClick={() => { setStatusFilter(new Set()); setDeptFilter(""); setPage(1); }}
                      >
                        Clear all filters
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
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Employee ID</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Onboarding</th>
                <th className="px-5 py-3">Invite Expires In</th>
                <th className="px-5 py-3">Last Login</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">
                    Loading team...
                  </td>
                </tr>
              ) : (
                paged.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">
                      No team members found.
                    </td>
                  </tr>
                ) : paged.map(e => (
                <tr key={e.user_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/10 shrink-0">
                        {e.first_name.charAt(0)}
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
                    <span className="text-xs text-muted-foreground">{departmentNameById(e.department_id)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={e.account_status} />
                  </td>
                  <td className="px-5 py-4 min-w-[140px]">
                    {onboardingMap[e.user_id] ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {onboardingMap[e.user_id].status === 'approved' ? 'Complete' : onboardingMap[e.user_id].status}
                          </span>
                          <span className="text-[10px] font-semibold text-foreground">
                            {onboardingMap[e.user_id].progress_percentage}%
                          </span>
                        </div>
                        <Progress
                          value={onboardingMap[e.user_id].progress_percentage}
                          className="h-1.5"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {e.account_status === "Pending" ? (
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {formatInviteCountdown(e.invite_expires_at, now)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatInviteDeadline(e.invite_expires_at)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">{formatLastLogin(e.last_login)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <RowMenu
                      employee={e}
                      onView={() => setViewEmployee(e)}
                      onDeactivate={() => setConfirmDeact(e)}
                      onReactivate={() => handleReactivate(e)}
                      onResendInvite={() => handleResendInvite(e)}
                      onAssignEmail={() => setAssignEmailEmployee(e)}
                    />
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
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

      {/* Panels & Dialogs */}
      {viewEmployee && (
        <ViewProfileSheet
          employee={viewEmployee}
          roles={roles}
          departments={departments}
          onClose={() => setViewEmployee(null)}
        />
      )}
      {confirmDeact && (
        <ConfirmDeactivate
          employee={confirmDeact}
          onClose={() => setConfirmDeact(null)}
          onConfirm={() => handleDeactivate(confirmDeact)}
        />
      )}
      {assignEmailEmployee && (
        <AssignEmailModal
          employee={assignEmailEmployee}
          onClose={() => setAssignEmailEmployee(null)}
          onSaved={(newEmail) => {
            setEmployees(prev => prev.map(e =>
              e.user_id === assignEmailEmployee.user_id ? { ...e, email: newEmail } : e
            ));
            setAssignEmailEmployee(null);
          }}
        />
      )}
    </div>
  );
}
