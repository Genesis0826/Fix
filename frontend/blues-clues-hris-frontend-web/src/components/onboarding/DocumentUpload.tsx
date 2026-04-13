"use client";

import { useState } from "react";
import { uploadDocument } from "@/lib/onboardingApi";
import { AlertCircle, Upload, FileText, X, History, FileUp, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DocumentItem, DocumentSubmission, Remark } from "@/types/onboarding.types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusIcon } from "./shared/StatusIcon";
import { StatusBadge } from "./shared/StatusBadge";
import { RemarksSection } from "./shared/RemarksSection";
import { formatFileSize, validateFile } from "./shared/utils";

interface DocumentUploadProps {
  documents: DocumentItem[];
  remarks: Remark[];
  onUpdate: (docs: DocumentItem[]) => void;
}

const ALLOWED_FILE_TYPES = new Set(["application/pdf"]);

export function DocumentUpload({ documents, remarks, onUpdate }: Readonly<DocumentUploadProps>) {
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  // Track which approved docs the user has chosen to reupload (to show confirmation)
  const [reuploadingApproved, setReuploadingApproved] = useState<Set<string>>(new Set());

  const hasPending = (id: string) => !!pendingFiles[id];
  const realFileUrl = (doc: DocumentItem) =>
    doc.files[0]?.file_url || null; // empty string from preview → falsy

  const handleFileSelect = (onboardingItemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = validateFile(file, ALLOWED_FILE_TYPES, "Only PDF files are allowed.");
    if (error) {
      setUploadErrors(prev => ({ ...prev, [onboardingItemId]: error }));
      event.target.value = "";
      return;
    }

    setUploadErrors(prev => ({ ...prev, [onboardingItemId]: "" }));
    setPendingFiles(prev => ({ ...prev, [onboardingItemId]: file }));

    const preview: DocumentSubmission = {
      submission_id: `preview-${Date.now()}`,
      onboarding_item_id: onboardingItemId,
      file_url: "",
      file_name: file.name,
      file_size_bytes: file.size,
      file_type: file.type,
      is_proof_of_receipt: false,
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
    };

    onUpdate(documents.map(doc =>
      doc.onboarding_item_id === onboardingItemId
        ? { ...doc, files: [preview], status: "pending" as const }
        : doc
    ));
    event.target.value = "";
  };

  const handleCancelStaged = (onboardingItemId: string) => {
    setPendingFiles(prev => { const n = { ...prev }; delete n[onboardingItemId]; return n; });
    setReuploadingApproved(prev => { const s = new Set(prev); s.delete(onboardingItemId); return s; });
    // Restore from upload_history if any, else clear
    onUpdate(documents.map(doc => {
      if (doc.onboarding_item_id !== onboardingItemId) return doc;
      const last = doc.upload_history.at(-1) ?? null;
      return {
        ...doc,
        files: last ? [last] : [],
        status: last ? (last.status === "approved" ? "approved" : "submitted") as const : "pending" as const,
      };
    }));
  };

  const handleSubmit = async (onboardingItemId: string) => {
    const file = pendingFiles[onboardingItemId];
    if (!file) return;

    setUploading(prev => ({ ...prev, [onboardingItemId]: true }));
    try {
      const submission = await uploadDocument(onboardingItemId, file, false);
      setPendingFiles(prev => { const n = { ...prev }; delete n[onboardingItemId]; return n; });
      setReuploadingApproved(prev => { const s = new Set(prev); s.delete(onboardingItemId); return s; });
      onUpdate(documents.map(doc =>
        doc.onboarding_item_id === onboardingItemId
          ? {
              ...doc,
              files: [submission],
              upload_history: [...doc.upload_history, submission],
              status: "submitted" as const,
            }
          : doc
      ));
    } catch {
      setUploadErrors(prev => ({ ...prev, [onboardingItemId]: "Upload failed. Please try again." }));
    } finally {
      setUploading(prev => ({ ...prev, [onboardingItemId]: false }));
    }
  };

  const triggerFileInput = (id: string) =>
    document.getElementById(`file-${id}`)?.click();

  return (
    <div className="space-y-4">
      {documents.length === 0 && (
        <p className="text-sm text-slate-400 py-8 text-center">No documents assigned.</p>
      )}

      {documents.map((doc) => {
        const id = doc.onboarding_item_id;
        const isPending = hasPending(id);
        const fileUrl = realFileUrl(doc);
        const isApproved = doc.status === "approved";
        const isDecided = ["approved", "submitted", "for-review"].includes(doc.status);
        const isRejected = doc.status === "rejected";
        const canReupload = !isPending && (isDecided || isRejected);
        const confirmingReupload = reuploadingApproved.has(id);

        return (
          <div key={id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-800 text-sm">{doc.title}</span>
                  {doc.is_required && <span className="text-red-500 text-xs font-bold">*</span>}
                </div>
                {doc.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusIcon status={doc.status} />
                <StatusBadge status={doc.status} />
              </div>
            </div>

            {/* Rejection note */}
            {isRejected && (
              <div className="mx-5 mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5">
                <p className="text-xs text-red-700 font-medium">
                  This document was rejected. Please upload a corrected version.
                </p>
              </div>
            )}

            {/* Re-approval warning when reuploading an approved doc */}
            {confirmingReupload && (
              <div className="mx-5 mb-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 flex items-start gap-2">
                <AlertCircle className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  Reuploading will replace the current approved file and require HR to re-approve it.
                </p>
              </div>
            )}

            {/* Current / staged file + actions */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 border-t border-slate-100">
              {/* File info */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {doc.files[0] ? (
                  <>
                    <FileText className="size-4 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 truncate">{doc.files[0].file_name}</p>
                      <p className="text-xs text-slate-400">{formatFileSize(doc.files[0].file_size_bytes)}</p>
                    </div>
                    {/* View button — only when we have a real URL */}
                    {fileUrl && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors ml-1"
                      >
                        <ExternalLink className="size-3" />View
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-slate-400">No file uploaded yet</span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Staged file — cancel / submit */}
                {isPending && (
                  <>
                    <Button variant="outline" size="sm" className="h-7"
                      onClick={() => handleCancelStaged(id)}
                      disabled={uploading[id]}>
                      <X className="size-3 mr-1" />Cancel
                    </Button>
                    <Button size="sm" className="h-7"
                      onClick={() => handleSubmit(id)}
                      disabled={uploading[id]}>
                      {uploading[id] ? "Uploading…" : "Submit"}
                    </Button>
                  </>
                )}

                {/* Initial upload (pending, no file staged) */}
                {!isPending && doc.status === "pending" && (
                  <>
                    <Button variant="outline" size="sm" className="h-7"
                      onClick={() => triggerFileInput(id)}>
                      <Upload className="size-3 mr-1" />Upload
                    </Button>
                    <input id={`file-${id}`} type="file" className="hidden" accept=".pdf"
                      onChange={(e) => handleFileSelect(id, e)} />
                  </>
                )}

                {/* Reupload for rejected / submitted / approved */}
                {canReupload && (
                  <>
                    {isApproved && !confirmingReupload ? (
                      <Button variant="outline" size="sm" className="h-7 border-amber-200 text-amber-700 hover:bg-amber-50"
                        onClick={() => setReuploadingApproved(prev => new Set(prev).add(id))}>
                        <RotateCcw className="size-3 mr-1" />Reupload
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" className="h-7"
                          onClick={() => triggerFileInput(id)}>
                          <FileUp className="size-3 mr-1" />
                          {isApproved ? "Choose File" : "Reupload"}
                        </Button>
                        {confirmingReupload && (
                          <button className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                            onClick={() => setReuploadingApproved(prev => { const s = new Set(prev); s.delete(id); return s; })}>
                            Cancel
                          </button>
                        )}
                        <input id={`file-${id}`} type="file" className="hidden" accept=".pdf"
                          onChange={(e) => handleFileSelect(id, e)} />
                      </>
                    )}
                  </>
                )}

                {/* Upload history dialog */}
                {doc.upload_history.length > 0 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-slate-600">
                        <History className="size-3.5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Upload History — {doc.title}</DialogTitle>
                        <DialogDescription>All previous submissions for this document</DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="max-h-80">
                        <div className="space-y-2 pr-2">
                          {doc.upload_history.slice().reverse().map((file, i) => (
                            <div key={file.submission_id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <FileText className="size-5 text-blue-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{file.file_name}</p>
                                <p className="text-xs text-slate-500">
                                  {formatFileSize(file.file_size_bytes)} · {new Date(file.uploaded_at).toLocaleString()}
                                  {i === 0 && <Badge className="ml-2 text-[10px] py-0 h-4">Latest</Badge>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <StatusBadge status={file.status} />
                                {file.file_url && (
                                  <a href={file.file_url} target="_blank" rel="noreferrer"
                                    className="text-blue-600 hover:text-blue-800">
                                    <ExternalLink className="size-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            {/* Upload error */}
            {uploadErrors[id] && (
              <div className="px-5 pb-3">
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="size-3.5" />
                  <AlertDescription className="text-xs">{uploadErrors[id]}</AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        );
      })}

      <RemarksSection remarks={remarks} />

      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
        <strong>File requirements:</strong> PDF only · Max 10 MB · One file per document.
        Reuploading an approved document will require HR to re-approve it.
      </div>
    </div>
  );
}
