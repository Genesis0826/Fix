"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  FileText,
  FileCheck,
  ShieldCheck,
  Landmark,
  X,
  CheckCircle2,
  Clock3,
  Files,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  getMyEmployeeDocuments,
  uploadMyDocument,
  deleteMyDocument,
  type EmployeeDocument,
} from "@/lib/authApi";
import { toast } from "sonner";

const REQUIRED_DOCUMENTS = [
  {
    id: "government-id",
    title: "Government ID",
    description: "Upload a valid government-issued identification card.",
    accepted: ".pdf,.png,.jpg,.jpeg",
    icon: ShieldCheck,
  },
  {
    id: "tax-form",
    title: "Tax Form",
    description: "Submit your required tax-related onboarding document.",
    accepted: ".pdf,.png,.jpg,.jpeg,.doc,.docx",
    icon: FileText,
  },
  {
    id: "employment-contract",
    title: "Signed Employment Contract",
    description: "Upload your signed employment contract for verification.",
    accepted: ".pdf,.doc,.docx",
    icon: FileCheck,
  },
  {
    id: "bank-details",
    title: "Bank Details / Payroll Form",
    description: "Provide your payroll-related bank document or form.",
    accepted: ".pdf,.png,.jpg,.jpeg,.doc,.docx",
    icon: Landmark,
  },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1">
        <Clock3 className="h-3 w-3" /> Pending HR Review
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1">
        <AlertCircle className="h-3 w-3" /> Rejected
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export default function EmployeeDocumentsPage() {
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = () => {
    setLoading(true);
    getMyEmployeeDocuments()
      .then(setDocs)
      .catch(() => toast.error("Failed to load documents."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (docId: string, file: File) => {
    setUploading((prev) => ({ ...prev, [docId]: true }));
    try {
      const uploaded = await uploadMyDocument(docId, file);
      setDocs((prev) => {
        const existing = prev.findIndex((d) => d.document_type === docId);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = uploaded;
          return next;
        }
        return [...prev, uploaded];
      });
      toast.success("Document uploaded. Awaiting HR review.");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed.");
    } finally {
      setUploading((prev) => ({ ...prev, [docId]: false }));
    }
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    setDeleting((prev) => ({ ...prev, [doc.id]: true }));
    try {
      await deleteMyDocument(doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Document removed.");
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed.");
    } finally {
      setDeleting((prev) => ({ ...prev, [doc.id]: false }));
    }
  };

  const approvedCount = docs.filter((d) => d.status === "approved").length;
  const pendingCount = docs.filter((d) => d.status === "pending").length;
  const rejectedCount = docs.filter((d) => d.status === "rejected").length;

  const getDocForType = (docId: string) =>
    docs.find((d) => d.document_type === docId) ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-[#1e3a8a] text-white p-8 shadow-sm">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-white/10 -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 right-16 h-24 w-24 rounded-full bg-white/10 translate-y-1/2" />
        <div className="relative z-10">
          <p className="text-sm uppercase tracking-[0.2em] text-white/70 font-semibold mb-2">
            Employee Documents
          </p>
          <h1 className="text-3xl font-bold mb-2">Your Documents</h1>
          <p className="text-sm text-white/80 max-w-2xl">
            Documents carried over from onboarding are pre-approved. Upload any missing documents for HR review.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Files className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Required</p>
              <p className="text-2xl font-bold text-gray-900">{REQUIRED_DOCUMENTS.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-2xl font-bold text-gray-900">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Rejected</p>
              <p className="text-2xl font-bold text-gray-900">{rejectedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900">Required Documents</CardTitle>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading documents…
            </div>
          ) : (
            REQUIRED_DOCUMENTS.map((docDef) => {
              const uploaded = getDocForType(docDef.id);
              const Icon = docDef.icon;
              const isUploading = uploading[docDef.id];
              const isDeleting = uploaded ? deleting[uploaded.id] : false;

              return (
                <div
                  key={docDef.id}
                  className="rounded-2xl border border-gray-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">{docDef.title}</h3>
                        {uploaded ? (
                          <StatusBadge status={uploaded.status} />
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">
                            Not uploaded
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-gray-500">{docDef.description}</p>
                      <p className="text-xs text-gray-400">Accepted: {docDef.accepted}</p>

                      {uploaded && (
                        <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3 mt-2">
                          <p className="text-sm font-medium text-gray-900">{uploaded.file_name}</p>
                          <p className="text-xs text-gray-500">
                            {uploaded.file_size ? formatBytes(uploaded.file_size) : ""} •{" "}
                            {new Date(uploaded.uploaded_at).toLocaleDateString()}
                          </p>
                          {uploaded.status === "rejected" && uploaded.hr_notes && (
                            <p className="text-xs text-red-600 mt-1">
                              HR Note: {uploaded.hr_notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <input
                      ref={(el) => { inputRefs.current[docDef.id] = el; }}
                      type="file"
                      accept={docDef.accepted}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(docDef.id, f);
                        e.target.value = "";
                      }}
                    />

                    {/* Can't upload over an approved doc */}
                    {uploaded?.status !== "approved" && (
                      <Button
                        onClick={() => inputRefs.current[docDef.id]?.click()}
                        disabled={isUploading}
                        className="h-10 px-4"
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploaded ? "Replace" : "Upload"}
                      </Button>
                    )}

                    {uploaded?.file_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 px-4"
                        asChild
                      >
                        <a href={uploaded.file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View
                        </a>
                      </Button>
                    )}

                    {uploaded && uploaded.status !== "approved" && (
                      <Button
                        variant="outline"
                        onClick={() => handleDelete(uploaded)}
                        disabled={isDeleting}
                        className="h-10 px-4"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <X className="h-4 w-4 mr-2" />
                        )}
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
