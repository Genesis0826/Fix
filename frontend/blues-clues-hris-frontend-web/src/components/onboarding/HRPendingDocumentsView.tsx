"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  FileText,
} from "lucide-react";
import {
  getPendingEmployeeDocuments,
  approveEmployeeDocument,
  rejectEmployeeDocument,
  type EmployeeDocument,
} from "@/lib/authApi";
import { toast } from "sonner";

type PendingDoc = EmployeeDocument & {
  user_profile: { first_name: string; last_name: string; employee_id: string };
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HRPendingDocumentsView() {
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    getPendingEmployeeDocuments()
      .then((data) => setDocs(data as PendingDoc[]))
      .catch(() => toast.error("Failed to load pending documents."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (docId: string) => {
    setProcessing((p) => ({ ...p, [docId]: true }));
    try {
      await approveEmployeeDocument(docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document approved.");
    } catch (e: any) {
      toast.error(e?.message ?? "Approve failed.");
    } finally {
      setProcessing((p) => ({ ...p, [docId]: false }));
    }
  };

  const handleReject = async (docId: string) => {
    const notes = rejectNotes[docId]?.trim();
    if (!notes) { toast.error("Please provide a reason for rejection."); return; }
    setProcessing((p) => ({ ...p, [docId]: true }));
    try {
      await rejectEmployeeDocument(docId, notes);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      setRejectOpen((p) => ({ ...p, [docId]: false }));
      toast.success("Document rejected.");
    } catch (e: any) {
      toast.error(e?.message ?? "Reject failed.");
    } finally {
      setProcessing((p) => ({ ...p, [docId]: false }));
    }
  };

  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">
          Pending Employee Documents
          {docs.length > 0 && (
            <Badge className="ml-2 bg-amber-100 text-amber-700 hover:bg-amber-100">
              {docs.length}
            </Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No pending documents to review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {docs.map((doc) => {
              const employeeName = `${doc.user_profile?.first_name ?? ""} ${doc.user_profile?.last_name ?? ""}`.trim();
              const employeeId = doc.user_profile?.employee_id ?? "";
              const isProcessing = processing[doc.id];

              return (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-gray-200 p-5 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{employeeName}</p>
                      {employeeId && (
                        <p className="text-xs text-gray-500">{employeeId}</p>
                      )}
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 w-fit">
                      Pending Review
                    </Badge>
                  </div>

                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {doc.document_type.replace(/-/g, " ")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {doc.file_name}{doc.file_size ? ` • ${formatBytes(doc.file_size)}` : ""}
                      </p>
                      <p className="text-xs text-gray-400">
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    {doc.file_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View File
                        </a>
                      </Button>
                    )}
                  </div>

                  {rejectOpen[doc.id] && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Reason for rejection (required)…"
                        value={rejectNotes[doc.id] ?? ""}
                        onChange={(e) =>
                          setRejectNotes((p) => ({ ...p, [doc.id]: e.target.value }))
                        }
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApprove(doc.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Approve
                    </Button>

                    {!rejectOpen[doc.id] ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => setRejectOpen((p) => ({ ...p, [doc.id]: true }))}
                        disabled={isProcessing}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(doc.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : null}
                          Confirm Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRejectOpen((p) => ({ ...p, [doc.id]: false }))}
                          disabled={isProcessing}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
