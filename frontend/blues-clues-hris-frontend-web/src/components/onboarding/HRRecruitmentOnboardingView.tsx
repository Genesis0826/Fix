"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle,
  ChevronRight,
  Loader2,
  UserCheck,
  XCircle,
} from "lucide-react";
import {
  approveOnboardingSubmission,
  getHROnboardingSubmissions,
  rejectOnboardingSubmission,
  type HROnboardingSubmission,
} from "@/lib/authApi";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Role = { role_id: string; role_name: string };
type Department = { department_id: string; department_name: string };

type StatusFilter = "all" | "pending" | "submitted" | "approved" | "rejected";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Submitted", value: "submitted" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending:   { label: "Pending",   variant: "secondary" },
  draft:     { label: "Draft",     variant: "outline" },
  submitted: { label: "Submitted", variant: "default" },
  approved:  { label: "Approved",  variant: "default" },
  rejected:  { label: "Rejected",  variant: "destructive" },
};

function StatusBadge({ status }: { readonly status: string }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, variant: "outline" as const };
  const colorClass =
    status === "approved"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : status === "submitted"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : status === "rejected"
      ? "bg-red-100 text-red-800 border-red-200"
      : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant={cfg.variant} className={`text-[11px] font-semibold capitalize border ${colorClass}`}>
      {cfg.label}
    </Badge>
  );
}

function LabeledField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null | undefined;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || <span className="text-muted-foreground italic">—</span>}</p>
    </div>
  );
}

function SectionTitle({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-4 pb-1 border-b border-border mb-3">
      {children}
    </p>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Detail Sheet
// ---------------------------------------------------------------------------
function SubmissionDetailSheet({
  submission,
  departments,
  open,
  onOpenChange,
  onApprove,
  onReject,
}: {
  readonly submission: HROnboardingSubmission | null;
  readonly departments: Department[];
  readonly open: boolean;
  readonly onOpenChange: (v: boolean) => void;
  readonly onApprove: (id: string) => void;
  readonly onReject: (id: string) => void;
}) {
  if (!submission) return null;

  const name = `${submission.applicant_profile.first_name} ${submission.applicant_profile.last_name}`;
  const deptName =
    departments.find((d) => d.department_id === submission.department_id)?.department_name ?? submission.department_id ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary shrink-0">
              {name.charAt(0)}
            </div>
            <div>
              <p className="text-base font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground font-normal">
                {submission.applicant_profile.email}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 mb-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={submission.status} />
            <span className="text-xs text-muted-foreground">
              Submitted: {formatDate(submission.submitted_at)}
            </span>
          </div>
          {submission.status === "rejected" && submission.hr_notes && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <p className="font-semibold text-xs uppercase tracking-wide mb-1">HR Feedback</p>
              {submission.hr_notes}
            </div>
          )}
        </div>

        {/* Personal Information */}
        <SectionTitle>Personal Information</SectionTitle>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <LabeledField label="First Name"    value={submission.first_name} />
          <LabeledField label="Last Name"     value={submission.last_name} />
          <LabeledField label="Phone"         value={submission.phone} />
          <LabeledField label="Date of Birth" value={formatDate(submission.date_of_birth)} />
          <LabeledField label="Nationality"   value={submission.nationality} />
          <LabeledField label="Civil Status"  value={submission.civil_status} />
          <LabeledField label="Address"       value={submission.address} />
        </div>

        {/* Emergency Contact */}
        <SectionTitle>Emergency Contact</SectionTitle>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <LabeledField label="Name"         value={submission.emergency_contact_name} />
          <LabeledField label="Phone"        value={submission.emergency_contact_phone} />
          <LabeledField label="Relationship" value={submission.emergency_contact_relationship} />
        </div>

        {/* Account Setup */}
        <SectionTitle>Account Setup</SectionTitle>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <LabeledField label="Username"   value={submission.preferred_username} />
          <LabeledField label="Department" value={deptName} />
          <LabeledField label="Start Date" value={formatDate(submission.start_date)} />
        </div>

        {/* Actions */}
        {submission.status === "submitted" && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => onReject(submission.submission_id)}
            >
              <XCircle className="h-4 w-4 mr-1.5" /> Reject
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onApprove(submission.submission_id)}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" /> Approve
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Approve Dialog
// ---------------------------------------------------------------------------
function ApproveDialog({
  open,
  onOpenChange,
  roles,
  onConfirm,
  loading,
}: {
  readonly open: boolean;
  readonly onOpenChange: (v: boolean) => void;
  readonly roles: Role[];
  readonly onConfirm: (roleId: string) => void;
  readonly loading: boolean;
}) {
  const [roleId, setRoleId] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Approve New Hire</DialogTitle>
          <DialogDescription>
            Select the employee role to assign. An invite email will be sent to
            create their account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="role-select">Employee Role</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger id="role-select">
              <SelectValue placeholder="Select a role..." />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.role_id} value={r.role_id}>
                  {r.role_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!roleId || loading}
            onClick={() => onConfirm(roleId)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserCheck className="h-4 w-4 mr-1.5" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Reject Dialog
// ---------------------------------------------------------------------------
function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  readonly open: boolean;
  readonly onOpenChange: (v: boolean) => void;
  readonly onConfirm: (notes: string) => void;
  readonly loading: boolean;
}) {
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reject Submission</DialogTitle>
          <DialogDescription>
            Provide feedback so the applicant can revise and resubmit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="hr-notes">Feedback / Reason</Label>
          <Textarea
            id="hr-notes"
            placeholder="e.g. Username already in use, please choose another..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!notes.trim() || loading}
            onClick={() => onConfirm(notes.trim())}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function HRRecruitmentOnboardingView() {
  const [submissions, setSubmissions] = useState<HROnboardingSubmission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<HROnboardingSubmission | null>(null);

  // Approve dialog
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  // Error/success toast
  const [notice, setNotice] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const showNotice = (kind: "success" | "error", msg: string) => {
    setNotice({ kind, msg });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [subsResult, rolesResult, deptsResult] = await Promise.allSettled([
      getHROnboardingSubmissions(),
      authFetch(`${API_BASE_URL}/users/roles`).then((r) => r.json() as Promise<Role[]>),
      authFetch(`${API_BASE_URL}/users/departments`).then((r) => r.json() as Promise<Department[]>),
    ]);
    if (subsResult.status === "fulfilled") {
      setSubmissions(subsResult.value);
    } else {
      setLoadError(
        subsResult.reason instanceof Error
          ? subsResult.reason.message
          : "Failed to load submissions. Please refresh.",
      );
    }
    if (rolesResult.status === "fulfilled") setRoles(rolesResult.value);
    if (deptsResult.status === "fulfilled") setDepartments(deptsResult.value);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered =
    statusFilter === "all"
      ? submissions
      : submissions.filter((s) => s.status === statusFilter);

  const openSheet = (sub: HROnboardingSubmission) => {
    setSelected(sub);
    setSheetOpen(true);
  };

  const handleApproveRequest = (id: string) => {
    setApproveTarget(id);
    setSheetOpen(false);
    setApproveOpen(true);
  };

  const handleRejectRequest = (id: string) => {
    setRejectTarget(id);
    setSheetOpen(false);
    setRejectOpen(true);
  };

  const handleApproveConfirm = async (roleId: string) => {
    if (!approveTarget) return;
    setApproveLoading(true);
    try {
      await approveOnboardingSubmission(approveTarget, roleId);
      // Optimistic update
      setSubmissions((prev) =>
        prev.map((s) =>
          s.submission_id === approveTarget ? { ...s, status: "approved" } : s,
        ),
      );
      setApproveOpen(false);
      setApproveTarget(null);
      showNotice("success", "Applicant approved. Invite email sent.");
    } catch (err) {
      showNotice("error", err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectConfirm = async (notes: string) => {
    if (!rejectTarget) return;
    setRejectLoading(true);
    try {
      await rejectOnboardingSubmission(rejectTarget, notes);
      // Optimistic update
      setSubmissions((prev) =>
        prev.map((s) =>
          s.submission_id === rejectTarget ? { ...s, status: "rejected", hr_notes: notes } : s,
        ),
      );
      setRejectOpen(false);
      setRejectTarget(null);
      showNotice("success", "Submission rejected. Applicant notified.");
    } catch (err) {
      showNotice("error", err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setRejectLoading(false);
    }
  };

  const submittedCount = submissions.filter((s) => s.status === "submitted").length;

  return (
    <div className="space-y-4">
      {/* Notice banner */}
      {notice && (
        <div
          className={`rounded-md px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${
            notice.kind === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {notice.kind === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          {notice.msg}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold">
              New Hire Approvals
              {submittedCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {submittedCount}
                </span>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
            </Button>
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 flex-wrap mt-3">
            {STATUS_FILTERS.map((f) => {
              const count =
                f.value === "all"
                  ? submissions.length
                  : submissions.filter((s) => s.status === f.value).length;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    statusFilter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                  {count > 0 && (
                    <span className="ml-1.5 opacity-70">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading submissions…</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <XCircle className="h-8 w-8 text-red-400 opacity-70" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Failed to load submissions</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="text-xs text-primary underline underline-offset-2 hover:opacity-80 cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <UserCheck className="h-8 w-8 opacity-30" />
              <p className="text-sm">No {statusFilter === "all" ? "" : statusFilter} submissions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-bold uppercase tracking-wide">Applicant</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wide">Job Title</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wide">Submitted</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wide">Status</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wide w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((sub) => {
                    const fullName = `${sub.applicant_profile.first_name} ${sub.applicant_profile.last_name}`;
                    const initials = sub.applicant_profile.first_name.charAt(0) + sub.applicant_profile.last_name.charAt(0);
                    return (
                      <TableRow
                        key={sub.submission_id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => openSheet(sub)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {initials.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{fullName}</p>
                              <p className="text-xs text-muted-foreground">{sub.applicant_profile.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sub.job_postings?.title ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(sub.submitted_at)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={sub.status} />
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <SubmissionDetailSheet
        submission={selected}
        departments={departments}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
      />

      {/* Approve Dialog */}
      <ApproveDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        roles={roles}
        onConfirm={handleApproveConfirm}
        loading={approveLoading}
      />

      {/* Reject Dialog */}
      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={handleRejectConfirm}
        loading={rejectLoading}
      />
    </div>
  );
}
