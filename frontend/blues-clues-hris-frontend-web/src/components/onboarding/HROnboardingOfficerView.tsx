"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, Users, FileCheck, ListChecks, Package, Search, Calendar, TrendingUp, Download, MessageSquare, CheckCircle, XCircle, FileText, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { OnboardingStatus, ItemStatus, OnboardingSessionSummary, OnboardingSession, Remark } from "@/types/onboarding.types";
import { getAllSessions, getSessionById, updateItemStatus, addRemark, approveSession, updateSessionDeadline } from "@/lib/onboardingApi";

function RemarkSection({
  remarks,
  value,
  onChange,
  onAdd,
  inputId,
}: {
  remarks: Remark[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  inputId: string;
}) {
  return (
    <div className="mt-6 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">HR Remarks</p>
      {remarks.length > 0 ? (
        <div className="space-y-2">
          {remarks.map((r) => (
            <div key={r.remark_id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-600">{r.author}</span>
                <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-slate-700">{r.remark_text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">No remarks yet.</p>
      )}
      <div className="flex gap-2 pt-1">
        <Textarea
          id={inputId}
          placeholder="Add a remark..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="resize-none text-sm"
        />
        <Button
          size="sm"
          className="self-end shrink-0"
          onClick={onAdd}
          disabled={!value.trim()}
        >
          <MessageSquare className="size-3.5 mr-1.5" />Add
        </Button>
      </div>
    </div>
  );
}

export default function HROnboardingOfficerView() {
  const [sessions, setSessions] = useState<OnboardingSessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<OnboardingSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [changingItems, setChangingItems] = useState<Set<string>>(new Set());

  const enterChangeMode = (id: string) => setChangingItems(prev => new Set(prev).add(id));
  const exitChangeMode  = (id: string) => setChangingItems(prev => { const s = new Set(prev); s.delete(id); return s; });

  useEffect(() => {
    getAllSessions().then(setSessions).catch(console.error);
  }, []);

  const refreshSession = async (sessionId: string) => {
    const [updatedSession, updatedSummaries] = await Promise.all([
      getSessionById(sessionId),
      getAllSessions(),
    ]);
    setSelectedSession(updatedSession);
    setSessions(updatedSummaries);
  };

  const handleViewSession = async (summary: OnboardingSessionSummary) => {
    setLoadingSession(true);
    setEditingDeadline(false);
    try {
      const full = await getSessionById(summary.session_id);
      setSelectedSession(full);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleApprove = async (onboardingItemId: string) => {
    if (!selectedSession) return;
    try {
      await updateItemStatus(onboardingItemId, "approved");
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (onboardingItemId: string) => {
    if (!selectedSession) return;
    try {
      await updateItemStatus(onboardingItemId, "rejected");
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleIssue = async (onboardingItemId: string) => {
    if (!selectedSession) return;
    try {
      await updateItemStatus(onboardingItemId, "issued");
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRemark = async (tabTag: "Documents" | "Tasks" | "Equipment" | "Profile" | "Forms") => {
    if (!selectedSession || !remarks[tabTag]?.trim()) return;
    try {
      await addRemark(selectedSession.session_id, tabTag, remarks[tabTag].trim());
      setRemarks(prev => ({ ...prev, [tabTag]: "" }));
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateDeadline = async () => {
    if (!selectedSession || !deadlineInput) return;
    try {
      await updateSessionDeadline(selectedSession.session_id, deadlineInput);
      setEditingDeadline(false);
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveSession = async () => {
    if (!selectedSession) return;
    try {
      await approveSession(selectedSession.session_id);
      await refreshSession(selectedSession.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  /** Renders approve/reject action row with smart decided-state UX */
  const renderItemActions = (
    itemId: string,
    status: ItemStatus,
    onApprove: () => void,
    onReject: () => void,
    issueMode?: { onIssue: () => void; issueLabel?: string },
  ) => {
    const isDecided = status === "approved" || status === "rejected" || status === "issued";
    const inChangeMode = changingItems.has(itemId);

    if (status === "pending") return null;

    if (isDecided && !inChangeMode) {
      const pill =
        status === "approved" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            <CheckCircle className="size-3.5" />Approved
          </span>
        ) : status === "issued" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-3 py-1">
            <CheckCircle className="size-3.5" />Issued
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
            <XCircle className="size-3.5" />Rejected
          </span>
        );
      return (
        <div className="flex items-center gap-2">
          {pill}
          <button
            className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 cursor-pointer transition-colors"
            onClick={() => enterChangeMode(itemId)}
          >
            Change
          </button>
        </div>
      );
    }

    // Undecided (submitted/confirmed/for-review) or in change mode
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-7 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
          onClick={() => { onReject(); exitChangeMode(itemId); }}>
          <XCircle className="size-3.5 mr-1" />Reject
        </Button>
        {issueMode ? (
          <Button size="sm" className="h-7 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => { issueMode.onIssue(); exitChangeMode(itemId); }}>
            <CheckCircle className="size-3.5 mr-1" />{issueMode.issueLabel ?? "Issue"}
          </Button>
        ) : (
          <Button size="sm" className="h-7 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
            onClick={() => { onApprove(); exitChangeMode(itemId); }}>
            <CheckCircle className="size-3.5 mr-1" />Approve
          </Button>
        )}
        {inChangeMode && (
          <button className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors" onClick={() => exitChangeMode(itemId)}>
            Cancel
          </button>
        )}
      </div>
    );
  };

  const getItemStatusBadge = (status: ItemStatus) => {
    const config: Record<string, { label: string; className: string }> = {
      "pending":    { label: "Pending",    className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
      "submitted":  { label: "Submitted",  className: "bg-slate-900 text-white hover:bg-slate-900" },
      "for-review": { label: "For Review", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
      "approved":   { label: "Approved",   className: "bg-teal-100 text-teal-800 hover:bg-teal-100" },
      "rejected":   { label: "Rejected",   className: "bg-red-100 text-red-800 hover:bg-red-100" },
      "issued":     { label: "Issued",     className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
      "confirmed":  { label: "Confirmed",  className: "bg-green-100 text-green-800 hover:bg-green-100" },
    };
    const { label, className } = config[status] ?? { label: status, className: "" };
    return <Badge className={className}>{label}</Badge>;
  };

  const getStatusBadge = (status: OnboardingStatus) => {
    const variants: Record<OnboardingStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      "not-started": { label: "Not Started", variant: "outline" },
      "in-progress": { label: "In Progress", variant: "default" },
      "for-review":  { label: "For Review",  variant: "secondary" },
      "approved":    { label: "Approved",    variant: "secondary" },
      "overdue":     { label: "Overdue",     variant: "destructive" },
    };
    const { label, variant } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getDeadlineColor = (deadlineDate: string, status: OnboardingStatus) => {
    if (status === "approved") return "text-green-600";
    const daysLeft = Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return "text-red-600 font-semibold";
    if (daysLeft <= 2) return "text-orange-600 font-semibold";
    return "text-slate-600";
  };

  const filteredSessions = sessions.filter((s) => {
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesDepartment = departmentFilter === "all" || s.assigned_department === departmentFilter;
    const matchesSearch =
      (s.employee_name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.assigned_position.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesDepartment && matchesSearch;
  });

  const totalEmployees = sessions.length;
  const inProgressCount = sessions.filter(s => s.status === "in-progress").length;
  const forReviewCount = sessions.filter(s => s.status === "for-review").length;
  const overdueCount = sessions.filter(s => s.status === "overdue").length;
  const avgProgress = totalEmployees > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.progress_percentage, 0) / totalEmployees)
    : 0;

  const departments = Array.from(new Set(sessions.map(s => s.assigned_department)));

  return (
    <div className="space-y-6">
        {/* Mini Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total New Hires</CardTitle>
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Users className="size-4 text-slate-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{totalEmployees}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Currently onboarding</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">In Progress</CardTitle>
              <div className="size-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <TrendingUp className="size-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{inProgressCount}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Active onboarding</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">For Review</CardTitle>
              <div className="size-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <FileCheck className="size-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{forReviewCount}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Avg. Progress</CardTitle>
              <div className="size-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <ListChecks className="size-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{avgProgress}%</div>
              <Progress value={avgProgress} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {(overdueCount > 0 || forReviewCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {overdueCount > 0 && (
              <Card className="border-red-100 bg-red-50/60 shadow-sm">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                      <Calendar className="size-4 text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-red-800">{overdueCount} Overdue Employee{overdueCount > 1 ? "s" : ""}</p>
                      <p className="text-xs text-red-600/80 mt-0.5">Requires immediate attention</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {forReviewCount > 0 && (
              <Card className="border-amber-100 bg-amber-50/60 shadow-sm">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <FileCheck className="size-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-amber-800">{forReviewCount} Pending Review</p>
                      <p className="text-xs text-amber-600/80 mt-0.5">Waiting for your approval</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Employee Overview Table */}
        <Card>
          <CardHeader>
            <CardTitle>New Hires in Onboarding</CardTitle>
            <div className="flex flex-col md:flex-row gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-45">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not-started">Not Started</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="for-review">For Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full md:w-45">
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => {
                  const daysLeft = Math.ceil((new Date(session.deadline_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <TableRow key={session.session_id}>
                      <TableCell className="font-medium">{session.employee_name ?? "—"}</TableCell>
                      <TableCell>{session.assigned_position}</TableCell>
                      <TableCell>{session.assigned_department}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={session.progress_percentage} className="w-20" />
                          <span className="text-sm text-slate-600">{session.progress_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell>
                        <div className={getDeadlineColor(session.deadline_date, session.status)}>
                          {new Date(session.deadline_date).toLocaleDateString()}
                          {session.status !== "approved" && (() => {
                            const absDays = Math.abs(daysLeft);
                            const label = daysLeft >= 0
                              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                              : `${absDays} day${absDays === 1 ? "" : "s"} overdue`;
                            return <div className="text-xs">{label}</div>;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewSession(session)}
                          disabled={loadingSession}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      No employees found matching your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      {/* Employee Detail Modal — Redesigned */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="sm:max-w-2xl max-w-[96vw] w-full p-0 gap-0 overflow-hidden flex flex-col rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedSession?.employee_name ?? "Onboarding"} — Onboarding Details</DialogTitle>
            <DialogDescription>Review and manage onboarding checklist items</DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="flex flex-col overflow-hidden" style={{ maxHeight: "88vh" }}>

              {/* ── GRADIENT HERO HEADER ── */}
              <div className="relative bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 pt-5 pb-5 shrink-0 overflow-hidden rounded-t-2xl">
                <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-16 w-36 h-36 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />
                {/* Identity row */}
                <div className="flex items-start justify-between gap-3 relative">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm text-white shrink-0">
                      {selectedSession.employee_name?.charAt(0) ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-white font-semibold text-base leading-tight truncate">{selectedSession.employee_name ?? "—"}</h2>
                      <p className="text-blue-200/80 text-xs mt-0.5 truncate">{selectedSession.assigned_position} · {selectedSession.assigned_department}</p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {selectedSession.status === "for-review" && (
                      <Button size="sm" className="bg-teal-600/80 hover:bg-teal-500 border border-teal-500/40 text-white h-8 text-xs" onClick={handleApproveSession}>
                        <CheckCircle className="size-3.5 mr-1.5" />Approve Onboarding
                      </Button>
                    )}
                    {selectedSession.status === "approved" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300 bg-teal-900/30 border border-teal-700/40 rounded-full px-3 py-1">
                        <CheckCircle className="size-3.5" />Approved
                      </span>
                    )}
                  </div>
                </div>
                {/* Meta row: status + progress + deadline */}
                <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-4 relative">
                  {getStatusBadge(selectedSession.status)}
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1 rounded-full bg-white/15 overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${selectedSession.progress_percentage}%` }} />
                    </div>
                    <span className="text-xs text-white/70">{selectedSession.progress_percentage}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <Calendar className="size-3.5 shrink-0" />
                    {editingDeadline ? (
                      <span className="flex items-center gap-1.5">
                        <Input type="date" value={deadlineInput} onChange={(e) => setDeadlineInput(e.target.value)}
                          className="h-6 text-xs bg-white/10 border-white/20 text-white px-2 py-0 w-32 rounded" />
                        <button className="text-blue-300 hover:text-blue-200 text-xs underline-offset-2 hover:underline cursor-pointer" onClick={handleUpdateDeadline}>Save</button>
                        <button className="text-white/40 hover:text-white/60 text-xs cursor-pointer" onClick={() => setEditingDeadline(false)}>Cancel</button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="text-white/70">{new Date(selectedSession.deadline_date).toLocaleDateString()}</span>
                        {selectedSession.status !== "approved" && (
                          <button className="text-blue-400 hover:text-blue-300 text-xs underline-offset-2 hover:underline cursor-pointer"
                            onClick={() => { setDeadlineInput(selectedSession.deadline_date.slice(0, 10)); setEditingDeadline(true); }}>
                            Edit
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  {selectedSession.status === "overdue" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-300 bg-red-900/30 border border-red-700/30 rounded-full px-2.5 py-0.5">
                      <AlertCircle className="size-3" />Overdue
                    </span>
                  )}
                </div>
              </div>

              {/* ── TABS ── */}
              <Tabs defaultValue="profile" className="flex flex-col flex-1 overflow-hidden">
                {/* Tab bar */}
                <div className="bg-white border-b px-4 py-2 shrink-0">
                    <TabsList className="flex h-9 gap-0.5 p-1 bg-slate-100 rounded-lg w-full">
                      {([
                        { value: "profile",   icon: Users,       label: "Profile"    },
                        { value: "documents", icon: FileCheck,   label: "Documents"  },
                        { value: "forms",     icon: FileText,    label: "HR Forms"   },
                        { value: "tasks",     icon: ListChecks,  label: "Tasks"      },
                        { value: "equipment", icon: Package,     label: "Equipment"  },
                      ] as const).map(({ value, icon: Icon, label }) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          className="flex flex-1 items-center justify-center gap-1.5 px-2 h-full text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:font-semibold transition-all"
                        >
                          <Icon className="size-3.5 shrink-0" />{label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  {/* Scrollable tab bodies */}
                  <div className="flex-1 overflow-y-auto">

                    {/* ── PROFILE TAB ── */}
                    <TabsContent value="profile" className="mt-0 p-6 space-y-4">
                      {selectedSession.profile ? (() => {
                        const profileItem = selectedSession.profile_items?.[0];
                        const profileItemStatus = profileItem?.status;
                        const canAct = profileItem && profileItemStatus !== "pending";
                        const contacts = selectedSession.profile!.emergency_contacts?.length
                          ? selectedSession.profile!.emergency_contacts
                          : selectedSession.profile!.contact_name
                            ? [{ contact_name: selectedSession.profile!.contact_name, relationship: selectedSession.profile!.relationship, emergency_phone_number: selectedSession.profile!.emergency_phone_number, emergency_email_address: selectedSession.profile!.emergency_email_address }]
                            : [];
                        return (
                          <div className="space-y-4">
                            {/* Action bar */}
                            {profileItem && profileItemStatus !== "pending" && (
                              <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex items-center gap-3 flex-wrap">
                                {(profileItemStatus === "submitted" || profileItemStatus === "confirmed" || profileItemStatus === "for-review") &&
                                  !changingItems.has(profileItem.onboarding_item_id) && (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                                    <AlertCircle className="size-3.5" />Awaiting review
                                  </span>
                                )}
                                {renderItemActions(
                                  profileItem.onboarding_item_id,
                                  profileItemStatus!,
                                  () => handleApprove(profileItem.onboarding_item_id),
                                  () => handleReject(profileItem.onboarding_item_id),
                                )}
                              </div>
                            )}

                            {/* Personal Info */}
                            <div className="bg-white rounded-lg border border-slate-200 p-5">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Personal Information</p>
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                                {[
                                  { label: "Full Name", value: `${selectedSession.profile!.first_name ?? ""} ${selectedSession.profile!.middle_name ? selectedSession.profile!.middle_name + " " : ""}${selectedSession.profile!.last_name ?? ""}`.trim() },
                                  { label: "Email", value: selectedSession.profile!.email_address, breakAll: true },
                                  { label: "Phone", value: selectedSession.profile!.phone_number },
                                  { label: "Date of Birth", value: selectedSession.profile!.date_of_birth },
                                  { label: "Place of Birth", value: selectedSession.profile!.place_of_birth },
                                  { label: "Civil Status", value: selectedSession.profile!.civil_status },
                                  { label: "Nationality", value: selectedSession.profile!.nationality },
                                  { label: "Address", value: selectedSession.profile!.complete_address, wide: true },
                                ].map(({ label, value, breakAll, wide }) => (
                                  <div key={label} className={`min-w-0 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">{label}</p>
                                    <p className={`text-sm text-slate-800 leading-snug ${breakAll ? "break-all" : ""}`}>{value || "—"}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Emergency Contacts */}
                            {contacts.length > 0 && (
                              <div className="bg-white rounded-lg border border-slate-200 p-5">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Emergency Contacts</p>
                                <div className="space-y-4">
                                  {contacts.map((c, i) => (
                                    <div key={i} className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Name</p>
                                        <p className="text-sm text-slate-800">{c.contact_name || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Relationship</p>
                                        <p className="text-sm text-slate-800">{c.relationship || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Phone</p>
                                        <p className="text-sm text-slate-800">{c.emergency_phone_number || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Email</p>
                                        <p className="text-sm text-slate-800 break-all">{c.emergency_email_address || "—"}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <Users className="size-10 mb-3 opacity-30" />
                          <p className="text-sm">No profile submitted yet</p>
                        </div>
                      )}

                      <RemarkSection
                        remarks={selectedSession.remarks.filter(r => r.tab_tag === "Profile")}
                        value={remarks["Profile"] || ""}
                        onChange={(v) => setRemarks(prev => ({ ...prev, Profile: v }))}
                        onAdd={() => handleAddRemark("Profile")}
                        inputId="remark-profile"
                      />
                    </TabsContent>

                    {/* ── DOCUMENTS TAB ── */}
                    <TabsContent value="documents" className="mt-0 p-6 space-y-3">
                      {selectedSession.documents.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <FileCheck className="size-10 mb-3 opacity-30" />
                          <p className="text-sm">No documents assigned</p>
                        </div>
                      )}
                      {selectedSession.documents.map((doc) => (
                        <div key={doc.onboarding_item_id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="min-w-0 pr-4">
                              <p className="font-semibold text-slate-800 text-sm">{doc.title}</p>
                              {doc.files[0]
                                ? <p className="text-xs text-slate-500 mt-0.5">Uploaded {new Date(doc.files[0].uploaded_at).toLocaleDateString()}</p>
                                : <p className="text-xs text-slate-400 mt-0.5">No file uploaded yet</p>
                              }
                            </div>
                            {getItemStatusBadge(doc.status)}
                          </div>
                          {(doc.files[0] || doc.status !== "pending") && (
                            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                {doc.files[0] && (
                                  <>
                                    <FileText className="size-4 text-slate-400 shrink-0" />
                                    <span className="text-sm text-slate-600 truncate">{doc.files[0].file_name}</span>
                                    <Button variant="outline" size="sm" asChild className="shrink-0 h-7">
                                      <a href={doc.files[0].file_url} target="_blank" rel="noreferrer">
                                        <Download className="size-3 mr-1" />View
                                      </a>
                                    </Button>
                                  </>
                                )}
                              </div>
                              <div className="shrink-0">
                                {renderItemActions(
                                  doc.onboarding_item_id,
                                  doc.status,
                                  () => handleApprove(doc.onboarding_item_id),
                                  () => handleReject(doc.onboarding_item_id),
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <RemarkSection
                        remarks={selectedSession.remarks.filter(r => r.tab_tag === "Documents")}
                        value={remarks["Documents"] || ""}
                        onChange={(v) => setRemarks(prev => ({ ...prev, Documents: v }))}
                        onAdd={() => handleAddRemark("Documents")}
                        inputId="remark-documents"
                      />
                    </TabsContent>

                    {/* ── HR FORMS TAB ── */}
                    <TabsContent value="forms" className="mt-0 p-6 space-y-3">
                      {selectedSession.hr_forms.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <FileText className="size-10 mb-3 opacity-30" />
                          <p className="text-sm">No HR forms assigned</p>
                        </div>
                      )}
                      {selectedSession.hr_forms.map((form) => (
                        <div key={form.onboarding_item_id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="min-w-0 pr-4">
                              <p className="font-semibold text-slate-800 text-sm">{form.title}</p>
                              {form.description && <p className="text-xs text-slate-500 mt-0.5">{form.description}</p>}
                            </div>
                            {getItemStatusBadge(form.status)}
                          </div>
                          {form.status !== "pending" && (
                            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                              {renderItemActions(
                                form.onboarding_item_id,
                                form.status,
                                () => handleApprove(form.onboarding_item_id),
                                () => handleReject(form.onboarding_item_id),
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      <RemarkSection
                        remarks={selectedSession.remarks.filter(r => r.tab_tag === "Forms")}
                        value={remarks["Forms"] || ""}
                        onChange={(v) => setRemarks(prev => ({ ...prev, Forms: v }))}
                        onAdd={() => handleAddRemark("Forms")}
                        inputId="remark-forms"
                      />
                    </TabsContent>

                    {/* ── TASKS TAB ── */}
                    <TabsContent value="tasks" className="mt-0 p-6 space-y-3">
                      {selectedSession.tasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <ListChecks className="size-10 mb-3 opacity-30" />
                          <p className="text-sm">No tasks assigned</p>
                        </div>
                      )}
                      {selectedSession.tasks.map((task) => (
                        <div key={task.onboarding_item_id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="min-w-0 pr-4">
                              <p className="font-semibold text-slate-800 text-sm">{task.title}</p>
                              {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}
                            </div>
                            {getItemStatusBadge(task.status)}
                          </div>
                          {task.status !== "pending" && (
                            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                              {renderItemActions(
                                task.onboarding_item_id,
                                task.status,
                                () => handleApprove(task.onboarding_item_id),
                                () => handleReject(task.onboarding_item_id),
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      <RemarkSection
                        remarks={selectedSession.remarks.filter(r => r.tab_tag === "Tasks")}
                        value={remarks["Tasks"] || ""}
                        onChange={(v) => setRemarks(prev => ({ ...prev, Tasks: v }))}
                        onAdd={() => handleAddRemark("Tasks")}
                        inputId="remark-tasks"
                      />
                    </TabsContent>

                    {/* ── EQUIPMENT TAB ── */}
                    <TabsContent value="equipment" className="mt-0 p-6 space-y-3">
                      {selectedSession.equipment.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <Package className="size-10 mb-3 opacity-30" />
                          <p className="text-sm">No equipment assigned</p>
                        </div>
                      )}
                      {selectedSession.equipment.map((equip) => (
                        <div key={equip.onboarding_item_id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="min-w-0 pr-4">
                              <p className="font-semibold text-slate-800 text-sm">{equip.title}</p>
                              {equip.description && <p className="text-xs text-slate-500 mt-0.5">{equip.description}</p>}
                              {equip.delivery_method && (
                                <p className="text-xs text-purple-600 mt-0.5">
                                  {equip.delivery_method === "office" ? "Office Pickup" : `Delivery${equip.delivery_address ? ` — ${equip.delivery_address}` : ""}`}
                                </p>
                              )}
                            </div>
                            {getItemStatusBadge(equip.status)}
                          </div>
                          {(equip.proof_of_receipt[0] || equip.status !== "pending") && (
                            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                {equip.proof_of_receipt[0] && (
                                  <>
                                    <FileText className="size-4 text-purple-500 shrink-0" />
                                    <span className="text-sm text-slate-600 truncate">{equip.proof_of_receipt[0].file_name}</span>
                                    <Button variant="outline" size="sm" asChild className="shrink-0 h-7">
                                      <a href={equip.proof_of_receipt[0].file_url} target="_blank" rel="noreferrer">
                                        <Download className="size-3 mr-1" />View
                                      </a>
                                    </Button>
                                  </>
                                )}
                              </div>
                              <div className="shrink-0">
                                {renderItemActions(
                                  equip.onboarding_item_id,
                                  equip.status,
                                  () => handleApprove(equip.onboarding_item_id),
                                  () => handleReject(equip.onboarding_item_id),
                                  { onIssue: () => handleIssue(equip.onboarding_item_id), issueLabel: "Issue" },
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <RemarkSection
                        remarks={selectedSession.remarks.filter(r => r.tab_tag === "Equipment")}
                        value={remarks["Equipment"] || ""}
                        onChange={(v) => setRemarks(prev => ({ ...prev, Equipment: v }))}
                        onAdd={() => handleAddRemark("Equipment")}
                        inputId="remark-equipment"
                      />
                    </TabsContent>

                  </div>
                </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
