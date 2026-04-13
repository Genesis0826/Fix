"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2, RefreshCw, User, CreditCard } from "lucide-react";
import {
  getHRChangeRequests,
  reviewChangeRequest,
  type ChangeRequest,
} from "@/lib/changeRequestApi";
import { toast } from "sonner";

function FieldDiff({ changes }: { changes: Record<string, string> }) {
  const labels: Record<string, string> = {
    first_name: "First Name",
    middle_name: "Middle Name",
    last_name: "Last Name",
    bank_name: "Bank Name",
    bank_account_number: "Account Number",
    bank_account_name: "Account Name",
  };
  return (
    <div className="space-y-1">
      {Object.entries(changes).map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-2 text-sm">
          <span className="text-muted-foreground text-xs w-32 shrink-0">{labels[key] ?? key}:</span>
          <span className="font-medium text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function HRProfileChangeRequestsView() {
  const [requests, setRequests]     = useState<ChangeRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    getHRChangeRequests("pending")
      .then(setRequests)
      .catch(() => toast.error("Failed to load profile change requests."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (req: ChangeRequest) => {
    setProcessing((p) => ({ ...p, [req.request_id]: true }));
    try {
      await reviewChangeRequest(req.request_id, { status: "approved", review_reason: "Approved by HR" });
      setRequests((prev) => prev.filter((r) => r.request_id !== req.request_id));
      toast.success(`${req.field_type === "legal_name" ? "Legal name" : "Bank account"} change approved.`);
    } catch {
      toast.error("Failed to approve request.");
    } finally {
      setProcessing((p) => ({ ...p, [req.request_id]: false }));
    }
  };

  const handleReject = async (req: ChangeRequest) => {
    const note = rejectNote[req.request_id]?.trim();
    if (!note) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setProcessing((p) => ({ ...p, [req.request_id]: true }));
    try {
      await reviewChangeRequest(req.request_id, { status: "rejected", review_reason: note });
      setRequests((prev) => prev.filter((r) => r.request_id !== req.request_id));
      toast.success("Change request rejected.");
    } catch {
      toast.error("Failed to reject request.");
    } finally {
      setProcessing((p) => ({ ...p, [req.request_id]: false }));
      setRejectOpen((p) => ({ ...p, [req.request_id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <p className="text-base font-semibold text-foreground">No pending requests</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          All profile change requests have been reviewed.
        </p>
        <Button variant="ghost" size="sm" onClick={load} className="gap-2 mt-1">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {requests.length} pending request{requests.length !== 1 ? "s" : ""}
        </p>
        <Button variant="ghost" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {requests.map((req) => {
        const employee = req.employee;
        const name = employee ? `${employee.first_name} ${employee.last_name}` : "Unknown Employee";
        const isLegalName = req.field_type === "legal_name";
        const Icon = isLegalName ? User : CreditCard;
        const isProcessing = processing[req.request_id];

        return (
          <Card key={req.request_id} className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isLegalName
                      ? "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                      : "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{name}</CardTitle>
                    {employee?.employee_id && (
                      <p className="text-xs text-muted-foreground">{employee.employee_id}</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={isLegalName
                  ? "border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800"
                  : "border-purple-200 text-purple-700 bg-purple-50 dark:bg-purple-900/10 dark:text-purple-400 dark:border-purple-800"
                }>
                  {isLegalName ? "Legal Name" : "Bank Account"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Requested changes */}
              <div className="bg-muted/30 rounded-lg p-3 border border-border">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2">
                  Requested Changes
                </p>
                <FieldDiff changes={req.requested_changes} />
              </div>

              {/* Reason */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Employee Reason
                </p>
                <p className="text-sm text-foreground/80 italic">"{req.reason}"</p>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Submitted {new Date(req.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </p>

              {/* Actions */}
              {rejectOpen[req.request_id] ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Reason for rejection (required)…"
                    rows={2}
                    value={rejectNote[req.request_id] ?? ""}
                    onChange={(e) => setRejectNote((p) => ({ ...p, [req.request_id]: e.target.value }))}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      disabled={isProcessing}
                      onClick={() => handleReject(req)}
                    >
                      {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      Confirm Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isProcessing}
                      onClick={() => setRejectOpen((p) => ({ ...p, [req.request_id]: false }))}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    disabled={isProcessing}
                    onClick={() => handleApprove(req)}
                  >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-destructive text-destructive hover:bg-destructive/10"
                    disabled={isProcessing}
                    onClick={() => setRejectOpen((p) => ({ ...p, [req.request_id]: true }))}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
