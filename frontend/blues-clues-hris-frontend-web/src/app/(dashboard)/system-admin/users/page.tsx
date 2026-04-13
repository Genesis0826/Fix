"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { getUserInfo, getAccessToken, parseJwt } from "@/lib/authStorage";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, UserPlus, MoreHorizontal, X,
  ChevronLeft, ChevronRight, Pencil, UserX, UserCheck,
  Filter, Download, Check, Mail, Eye, Hash, User,
  Building2, Calendar, Shield, Loader2, Plus, Trash2,
} from "lucide-react";
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

function formatDate(value: string | null) {
  if (!value) return "Never";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Unknown"
    : d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: Readonly<{ label: string; value: number; sub: string; color: string }>) {
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

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${style}`}>
      {status}
    </span>
  );
}

// ── Row action dropdown ───────────────────────────────────────────────────────

function RowMenu({
  employee, onView, onEdit, onDeactivate, onReactivate, onResendInvite,
}: Readonly<{
  employee: Employee;
  onView: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onResendInvite: () => void;
}>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onView} className="gap-2.5 cursor-pointer">
          <Eye className="h-4 w-4" /> View Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit} className="gap-2.5 cursor-pointer">
          <Pencil className="h-4 w-4" /> Edit Employee
        </DropdownMenuItem>
        {employee.account_status === "Pending" && (
          <DropdownMenuItem onClick={onResendInvite} className="gap-2.5 cursor-pointer">
            <Mail className="h-4 w-4" /> Resend Invite
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {employee.account_status === "Inactive" ? (
          <DropdownMenuItem
            onClick={onReactivate}
            className="gap-2.5 cursor-pointer text-green-600 focus:text-green-600 focus:bg-green-50"
          >
            <UserCheck className="h-4 w-4" /> Reactivate Account
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={onDeactivate}
            className="gap-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <UserX className="h-4 w-4" /> Deactivate Account
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── View Profile Sheet ────────────────────────────────────────────────────────

function ViewProfileSheet({
  employee, roles, departments, onClose,
}: Readonly<{
  employee: Employee;
  roles: Role[];
  departments: Department[];
  onClose: () => void;
}>) {
  const name = `${employee.first_name} ${employee.last_name}`.trim() || employee.email;
  const roleName = roles.find(r => r.role_id === employee.role_id)?.role_name ?? null;
  const deptName = departments.find(d => d.department_id === employee.department_id)?.department_name ?? null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-md bg-background shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Employee Profile</p>
            <h2 className="text-lg font-bold text-foreground">{name}</h2>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl border border-primary/10 shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-xl">{name}</p>
              <p className="text-sm text-muted-foreground">{employee.email}</p>
              <div className="mt-1.5"><StatusBadge status={employee.account_status} /></div>
            </div>
          </div>
          <div className="space-y-3">
            <ProfileField icon={Hash}      label="Employee ID"  value={employee.employee_id} />
            <ProfileField icon={User}      label="Username"     value={employee.username} />
            <ProfileField icon={Shield}    label="Role"         value={roleName} />
            <ProfileField icon={Building2} label="Department"   value={deptName} />
            <ProfileField icon={Calendar}  label="Start Date"   value={employee.start_date ? new Date(employee.start_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null} />
            <ProfileField icon={Calendar}  label="Last Login"   value={formatDate(employee.last_login)} />
          </div>
          {employee.account_status === "Pending" && employee.invite_expires_at && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-0.5">Invite pending</p>
              <p className="text-xs opacity-80">Expires {formatDate(employee.invite_expires_at)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ icon: Icon, label, value }: Readonly<{ icon: React.ElementType; label: string; value?: string | null }>) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value ?? "—"}</p>
      </div>
    </div>
  );
}

// ── Add User slide-over ───────────────────────────────────────────────────────

function AddUserPanel({ roles, onClose, onCreated }: Readonly<{
  roles: Role[];
  onClose: () => void;
  onCreated: (employee: Employee) => void;
}>) {
  const [form, setForm] = useState({
    first_name: "", last_name: "", username: "", email: "",
    role_id: "", department_id: "", start_date: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.username.trim()) e.username = "Required";
    else if (/\s/.test(form.username)) e.username = "Username must not contain spaces";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (!form.role_id) e.role_id = "Required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const payload: Record<string, string> = {
        first_name: form.first_name, last_name: form.last_name,
        username: form.username, email: form.email, role_id: form.role_id,
      };
      if (form.department_id) payload.department_id = form.department_id;
      if (form.start_date) payload.start_date = form.start_date;

      const res = await apiFetch<{ user_id: string; employee_id: string; email: string; username: string; company_id: string | null }>("/users", {
        method: "POST", body: JSON.stringify(payload),
      });

      onCreated({
        user_id: res.user_id, employee_id: res.employee_id, username: res.username,
        first_name: form.first_name, last_name: form.last_name, email: res.email,
        company_id: res.company_id ?? null,
        role_id: form.role_id, department_id: form.department_id.trim() || null,
        start_date: form.start_date || null, account_status: "Pending",
        last_login: null, invite_expires_at: null,
      });
      toast.success("User created. Invite email sent.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create user.");
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: string, type = "text", placeholder = "") => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
      <Input type={type} placeholder={placeholder} value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        className={errors[key] ? "border-red-400 focus-visible:ring-red-300" : ""} />
      {errors[key] && <p className="text-xs text-red-500">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative bg-card w-full max-w-md h-full shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">Add New User</h2>
            <p className="text-xs text-muted-foreground">Provision a new account for your company</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {field("First Name", "first_name", "text", "e.g. Juan")}
            {field("Last Name", "last_name", "text", "e.g. dela Cruz")}
          </div>
          {field("Username", "username", "text", "e.g. juan.delacruz")}
          {field("Email", "email", "email", "e.g. juan@company.com")}
          <div className="space-y-1.5">
            <label htmlFor="add-user-role" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Role</label>
            <select id="add-user-role" value={form.role_id} onChange={e => set("role_id", e.target.value)}
              className={`w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.role_id ? "border-red-400" : "border-input"}`}>
              <option value="">Select role...</option>
              {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
            </select>
            {errors.role_id && <p className="text-xs text-red-500">{errors.role_id}</p>}
          </div>
          {field("Department ID", "department_id", "text", "Optional")}
          {field("Start Date", "start_date", "date")}
        </div>
        <div className="px-6 py-5 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Employee"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Employee Modal (centered, matching HR dashboard style) ───────────────

function EditEmployeeModal({
  employee, roles, departments, onClose, onSaved,
}: Readonly<{
  employee: Employee;
  roles: Role[];
  departments: Department[];
  onClose: () => void;
  onSaved: (updated: Employee) => void;
}>) {
  const [form, setForm] = useState({
    first_name: employee.first_name,
    last_name: employee.last_name,
    role_id: employee.role_id ?? "",
    department_id: employee.department_id ?? "",
    start_date: employee.start_date ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.role_id) e.role_id = "Required";
    return e;
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button type="button" className="absolute inset-0 bg-black/50 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Edit Employee</p>
            <h2 className="text-base font-bold">
              {employee.first_name} {employee.last_name} · {employee.employee_id}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-username" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Username</label>
            <Input id="edit-username" value={employee.username} disabled className="opacity-60 cursor-not-allowed h-10" />
            <p className="text-[11px] text-muted-foreground">Username cannot be changed after account creation.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-first-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
              <Input id="edit-first-name" value={form.first_name} onChange={e => set("first_name", e.target.value)}
                className={`h-10 ${errors.first_name ? "border-red-400" : ""}`} />
              {errors.first_name && <p className="text-xs text-red-500">{errors.first_name}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-last-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Last Name</label>
              <Input id="edit-last-name" value={form.last_name} onChange={e => set("last_name", e.target.value)}
                className={`h-10 ${errors.last_name ? "border-red-400" : ""}`} />
              {errors.last_name && <p className="text-xs text-red-500">{errors.last_name}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-role" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Role</label>
            <select id="edit-role" value={form.role_id} onChange={e => set("role_id", e.target.value)}
              className={`w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.role_id ? "border-red-400" : "border-input"}`}>
              <option value="">Select role...</option>
              {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
            </select>
            {errors.role_id && <p className="text-xs text-red-500">{errors.role_id}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-department" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Department</label>
            <select id="edit-department" value={form.department_id} onChange={e => set("department_id", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">— No department —</option>
              {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-start-date" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Start Date</label>
            <Input id="edit-start-date" type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} className="h-10" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Department Manage Slide-over ──────────────────────────────────────────────

function DeptManageSheet({
  dept,
  departments,
  employees,
  onClose,
  onRename,
  onDelete,
  onAssignMembers,
  onUnassignMember,
}: Readonly<{
  dept: Department;
  departments: Department[];
  employees: Employee[];
  onClose: () => void;
  onRename: (dept: Department, newName: string) => Promise<void>;
  onDelete: (dept: Department) => Promise<void>;
  onAssignMembers: (dept: Department, userIds: string[]) => Promise<void>;
  onUnassignMember: (dept: Department, emp: Employee) => Promise<void>;
}>) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(dept.department_name);
  const [pendingAssign, setPendingAssign] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const members = employees.filter(e => e.department_id === dept.department_id);
  const otherEmployees = employees.filter(e => e.department_id !== dept.department_id);
  const filteredOther = memberSearch.trim()
    ? otherEmployees.filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(memberSearch.toLowerCase()))
    : otherEmployees;

  const handleRename = async () => {
    if (!renameValue.trim() || renameValue.trim() === dept.department_name) {
      setIsRenaming(false);
      setRenameValue(dept.department_name);
      return;
    }
    setLoading(true);
    try { await onRename(dept, renameValue.trim()); setIsRenaming(false); }
    catch { setRenameValue(dept.department_name); setIsRenaming(false); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setLoading(true);
    try { await onDelete(dept); } finally { setLoading(false); }
  };

  const handleAssign = async () => {
    if (pendingAssign.size === 0) return;
    setLoading(true);
    try { await onAssignMembers(dept, Array.from(pendingAssign)); setPendingAssign(new Set()); }
    finally { setLoading(false); }
  };

  const handleUnassign = async (emp: Employee) => {
    setLoading(true);
    try { await onUnassignMember(dept, emp); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-md bg-background shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Department</p>
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") { setIsRenaming(false); setRenameValue(dept.department_name); }
                }}
                onBlur={handleRename}
                className="w-full h-8 px-2 rounded-md border border-primary bg-background text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            ) : (
              <h2 className="text-lg font-bold text-foreground truncate">{dept.department_name}</h2>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{members.length} member{members.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setIsRenaming(true); setRenameValue(dept.department_name); }}
              className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors" title="Rename">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={handleDelete} disabled={loading}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50" title="Delete department">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors ml-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Current Members */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Current Members ({members.length})
            </p>
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No members yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map(emp => (
                  <div key={emp.user_id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                    <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {emp.first_name.charAt(0)}
                    </div>
                    <span>{emp.first_name} {emp.last_name}</span>
                    <button onClick={() => handleUnassign(emp)} disabled={loading}
                      className="text-primary/60 hover:text-destructive transition-colors ml-0.5 disabled:opacity-50">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Add / Move Members */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Add / Move Members
            </p>
            <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
              Employees already in another department are shown with their current team — selecting them will move them here.
            </p>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input type="text" placeholder="Search employees..."
                value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                className="w-full pl-8 h-8 rounded-md border border-input bg-background text-xs px-3 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            {otherEmployees.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">All employees are already in this department.</p>
            ) : (
              filteredOther.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No employees match your search.</p>
              ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {filteredOther.map(emp => {
                  const checked = pendingAssign.has(emp.user_id);
                  const currentDeptName = departments.find(d => d.department_id === emp.department_id)?.department_name;
                  return (
                    <label key={emp.user_id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? "bg-primary/10 border-primary"
                          : "bg-background border-border hover:border-primary/40 hover:bg-muted/20"
                      }`}>
                      <input type="checkbox" checked={checked}
                        onChange={() => {
                          setPendingAssign(prev => {
                            const next = new Set(prev);
                            checked ? next.delete(emp.user_id) : next.add(emp.user_id);
                            return next;
                          });
                        }}
                        className="h-3.5 w-3.5 accent-primary shrink-0" />
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                        {emp.first_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${checked ? "text-primary" : "text-foreground"}`}>
                          {emp.first_name} {emp.last_name}
                        </p>
                        {currentDeptName && (
                          <p className="text-[10px] text-amber-600 font-medium">Currently in: {currentDeptName}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        {pendingAssign.size > 0 && (
          <div className="px-6 py-4 border-t border-border shrink-0">
            <Button className="w-full gap-2" onClick={handleAssign} disabled={loading}>
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Plus className="h-4 w-4" /> Assign {pendingAssign.size} Employee{pendingAssign.size === 1 ? "" : "s"} to {dept.department_name}</>
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Deactivate confirmation ───────────────────────────────────────────────────

function ConfirmDeactivate({ employee, onClose, onConfirm }: Readonly<{
  employee: Employee; onClose: () => void; onConfirm: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-lg text-red-600"><UserX className="h-5 w-5" /></div>
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

export default function AdminUsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = getUserInfo();
  const currentUserId = parseJwt(getAccessToken() ?? "")?.sub_userid;
  useWelcomeToast(user?.name || "Admin", "User Management");

  const [employees, setEmployees]         = useState<Employee[]>([]);
  const [stats, setStats]                 = useState<Stats | null>(null);
  const [roles, setRoles]                 = useState<Role[]>([]);
  const [departments, setDepartments]     = useState<Department[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState(searchParams.get("q") ?? "");

  // Sync URL ?q= → local search state
  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);
  const [page, setPage]                   = useState(1);

  const [showAdd, setShowAdd]             = useState(false);
  const [viewEmployee, setViewEmployee]   = useState<Employee | null>(null);
  const [editEmployee, setEditEmployee]   = useState<Employee | null>(null);
  const [confirmDeact, setConfirmDeact]   = useState<Employee | null>(null);
  const [showFilter, setShowFilter]       = useState(false);
  const [statusFilter, setStatusFilter]   = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter]       = useState<string | null>(null);
  const filterRef                         = useRef<HTMLDivElement>(null);
  const [newDeptName, setNewDeptName]     = useState("");
  const [deptLoading, setDeptLoading]     = useState(false);
  const [manageDept, setManageDept]       = useState<Department | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, statsData, rolesData, deptsData] = await Promise.all([
        apiFetch<Employee[]>("/users"),
        apiFetch<Stats>("/users/stats"),
        apiFetch<Role[]>("/users/roles"),
        apiFetch<Department[]>("/users/departments").catch(() => [] as Department[]),
      ]);
      setEmployees(users);
      setStats(statsData);
      setRoles(rolesData);
      setDepartments(Array.isArray(deptsData) ? deptsData : []);
    } catch {
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchesSearch = (
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employee_id.toLowerCase().includes(q)
    );
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

  const handleCreated = (employee: Employee) => {
    setEmployees(prev => [employee, ...prev]);
    setStats(prev => prev ? { total: prev.total + 1 } : prev);
    setShowAdd(false);
  };

  const handleEditSaved = (updated: Employee) => {
    setEmployees(prev => prev.map(e => e.user_id === updated.user_id ? updated : e));
    setEditEmployee(null);
  };

  const handleResendInvite = async (employee: Employee) => {
    try {
      const res = await apiFetch<{ message: string; invite_expires_at: string }>(`/users/${employee.user_id}/resend-invite`, { method: "PATCH" });
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
      const res = await apiFetch<{ message?: string }>(`/users/${employee.user_id}/reactivate`, { method: "PATCH" });
      const nextStatus = res.message?.includes("Pending") ? "Pending" : "Active";
      setEmployees(prev => prev.map(e =>
        e.user_id === employee.user_id ? { ...e, account_status: nextStatus } : e
      ));
      toast.success(`${employee.first_name}'s account reactivated as ${nextStatus.toLowerCase()}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to reactivate account.");
    }
  };

  const handleAddDept = async () => {
    const name = newDeptName.trim();
    if (!name) return;
    setDeptLoading(true);
    try {
      const created = await apiFetch<Department>("/users/departments", {
        method: "POST",
        body: JSON.stringify({ department_name: name }),
      });
      setDepartments(prev => [...prev, created]);
      setNewDeptName("");
      toast.success(`Department "${name}" created.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create department.");
    } finally {
      setDeptLoading(false);
    }
  };

  const handleDeleteDept = async (dept: Department) => {
    try {
      await apiFetch(`/users/departments/${dept.department_id}`, { method: "DELETE" });
      setDepartments(prev => prev.filter(d => d.department_id !== dept.department_id));
      setEmployees(prev => prev.map(e =>
        e.department_id === dept.department_id ? { ...e, department_id: null } : e
      ));
      setManageDept(null);
      toast.success(`Department "${dept.department_name}" deleted.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete department.");
      throw err;
    }
  };

  const handleRenameDept = async (dept: Department, newName: string) => {
    try {
      const updated = await apiFetch<Department>(`/users/departments/${dept.department_id}`, {
        method: "PATCH",
        body: JSON.stringify({ department_name: newName }),
      });
      setDepartments(prev => prev.map(d => d.department_id === dept.department_id ? updated : d));
      setManageDept(updated);
      toast.success("Department renamed.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to rename department.");
      throw err;
    }
  };

  const handleAssignMembers = async (dept: Department, userIds: string[]) => {
    if (userIds.length === 0) return;
    try {
      await Promise.all(
        userIds.map(userId =>
          apiFetch(`/users/${userId}`, {
            method: "PATCH",
            body: JSON.stringify({ department_id: dept.department_id }),
          })
        )
      );
      setEmployees(prev => prev.map(e =>
        userIds.includes(e.user_id) ? { ...e, department_id: dept.department_id } : e
      ));
      toast.success(`${userIds.length} employee${userIds.length === 1 ? "" : "s"} added to ${dept.department_name}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign members.");
      throw err;
    }
  };

  const handleUnassignMember = async (dept: Department, emp: Employee) => {
    try {
      await apiFetch(`/users/${emp.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ department_id: null }),
      });
      setEmployees(prev => prev.map(e =>
        e.user_id === emp.user_id ? { ...e, department_id: null } : e
      ));
      toast.success(`${emp.first_name} removed from ${dept.department_name}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove member.");
      throw err;
    }
  };

  const loadedRows = paged.length === 0 ? (
    <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No employees found.</td></tr>
  ) : (
    <>
      {paged.map(e => (
        <tr key={e.user_id} className="hover:bg-muted/20 transition-colors">
          <td className="px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/10 shrink-0">
                {e.first_name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-foreground leading-none">{e.first_name} {e.last_name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{e.email}</p>
              </div>
            </div>
          </td>
          <td className="px-5 py-4"><span className="font-mono text-xs text-muted-foreground">{e.employee_id}</span></td>
          <td className="px-5 py-4"><span className="text-xs font-semibold text-foreground">{roles.find(r => r.role_id === e.role_id)?.role_name ?? "—"}</span></td>
          <td className="px-5 py-4"><span className="text-xs text-muted-foreground">{departments.find(d => d.department_id === e.department_id)?.department_name ?? (e.department_id ?? "—")}</span></td>
          <td className="px-5 py-4"><StatusBadge status={e.account_status} /></td>
          <td className="px-5 py-4"><span className="text-xs text-muted-foreground">{formatDate(e.invite_expires_at)}</span></td>
          <td className="px-5 py-4"><span className="text-xs text-muted-foreground">{formatDate(e.last_login)}</span></td>
          <td className="px-5 py-4 text-right">
            {e.user_id === currentUserId ? (
              <span className="text-[11px] text-muted-foreground italic px-2">You</span>
            ) : (
              <RowMenu
                employee={e}
                onView={() => setViewEmployee(e)}
                onEdit={() => setEditEmployee(e)}
                onDeactivate={() => setConfirmDeact(e)}
                onReactivate={() => handleReactivate(e)}
                onResendInvite={() => handleResendInvite(e)}
              />
            )}
          </td>
        </tr>
      ))}
    </>
  );

  const tableRows = loading ? (
    <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">Loading employees...</td></tr>
  ) : loadedRows;

  return (
    <div className="space-y-6">

      {/* Welcome card */}
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">System Administration</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">User Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Create, manage, and monitor all internal user accounts and access controls.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Total Users</p>
            <p className="mt-1 text-lg font-bold">{stats?.total ?? "—"}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Users"  value={stats?.total ?? 0}  sub="All accounts"         color="text-foreground" />
        <StatCard label="Active"       value={activeCount}         sub="Currently active"     color="text-green-600" />
        <StatCard label="Pending"      value={pendingCount}        sub="Awaiting activation"  color="text-amber-600" />
        <StatCard label="Inactive"     value={inactiveCount}       sub="Deactivated accounts" color="text-red-600" />
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-base">System Users</h2>
            <p className="text-xs text-muted-foreground">Manage your organization's user accounts</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search employees..." value={search}
                onChange={e => {
                const v = e.target.value;
                setSearch(v); setPage(1);
                const params = new URLSearchParams(searchParams.toString());
                if (v) params.set("q", v); else params.delete("q");
                router.replace(`${pathname}?${params.toString()}`, { scroll: false } as any);
              }}
                className="pl-9 h-9 w-full sm:w-60" />
            </div>
            <div className="relative shrink-0" ref={filterRef}>
              <Button variant="outline" size="icon"
                className={`h-9 w-9 ${statusFilter.size > 0 ? "border-primary text-primary" : ""}`}
                onClick={() => setShowFilter(v => !v)}>
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
                    <button key={s}
                      className="flex items-center justify-between px-3 py-2 w-full hover:bg-muted/50 text-sm text-foreground"
                      onClick={() => toggleStatus(s)}>
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
                      <button className="px-3 py-2 w-full text-left text-xs text-muted-foreground hover:bg-muted/50"
                        onClick={() => { setStatusFilter(new Set()); setPage(1); }}>
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
            <Button variant="outline" className="h-9 gap-1.5 shrink-0" onClick={() => document.getElementById("dept-section")?.scrollIntoView({ behavior: "smooth" })}>
              <Building2 className="h-4 w-4" /> Departments
            </Button>
            <Button className="h-9 gap-1.5 shrink-0" onClick={() => setShowAdd(true)}>
              <UserPlus className="h-4 w-4" /> Add User
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Employee ID</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Invite Expires In</th>
                <th className="px-5 py-3">Last Login</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tableRows}
            </tbody>
          </table>
        </div>

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

      {/* Department Management */}
      <div id="dept-section" className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-base">Department Management</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Add or remove departments for your organisation</p>
          </div>
          <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
            {departments.length} dept{departments.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Add form */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
          <div className="relative flex-1">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="New department name..."
              value={newDeptName}
              onChange={e => setNewDeptName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddDept()}
              className="w-full pl-9 h-9 rounded-md border border-input bg-background text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Button className="h-9 gap-1.5 shrink-0" onClick={handleAddDept} disabled={deptLoading || !newDeptName.trim()}>
            {deptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add</>}
          </Button>
        </div>

        {/* Department list */}
        <div className="divide-y divide-border">
          {departments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No departments yet. Add one above.</p>
          ) : departments.map(dept => {
            const memberCount = employees.filter(e => e.department_id === dept.department_id).length;
            return (
              <div key={dept.department_id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{dept.department_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {memberCount} member{memberCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() => setManageDept(dept)}
                  className="text-xs font-bold text-primary hover:underline shrink-0"
                >
                  Manage →
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {showAdd && <AddUserPanel roles={roles} onClose={() => setShowAdd(false)} onCreated={handleCreated} />}
      {viewEmployee && (
        <ViewProfileSheet employee={viewEmployee} roles={roles} departments={departments} onClose={() => setViewEmployee(null)} />
      )}
      {editEmployee && (
        <EditEmployeeModal employee={editEmployee} roles={roles} departments={departments}
          onClose={() => setEditEmployee(null)} onSaved={handleEditSaved} />
      )}
      {confirmDeact && (
        <ConfirmDeactivate employee={confirmDeact} onClose={() => setConfirmDeact(null)}
          onConfirm={() => handleDeactivate(confirmDeact)} />
      )}
      {manageDept && (
        <DeptManageSheet
          dept={manageDept}
          departments={departments}
          employees={employees}
          onClose={() => setManageDept(null)}
          onRename={handleRenameDept}
          onDelete={handleDeleteDept}
          onAssignMembers={handleAssignMembers}
          onUnassignMember={handleUnassignMember}
        />
      )}
    </div>
  );
}
