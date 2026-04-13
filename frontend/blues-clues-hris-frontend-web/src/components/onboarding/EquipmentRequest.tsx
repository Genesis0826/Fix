import { useState } from "react";
import { requestEquipment, uploadDocument, confirmTask } from "@/lib/onboardingApi";
import { CheckCircle, AlertCircle, Upload, FileText, Eye, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EquipmentItem, DocumentSubmission, Remark } from "@/types/onboarding.types";
import { StatusIcon } from "./shared/StatusIcon";
import { StatusBadge } from "./shared/StatusBadge";
import { RemarksSection } from "./shared/RemarksSection";
import { formatFileSize, validateFile as validateFileUtil } from "./shared/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EquipmentRequestProps {
  equipment: EquipmentItem[];
  remarks: Remark[];
  onUpdateEquipment: (equipment: EquipmentItem[]) => void;
}

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function EquipmentRequest({ equipment, remarks, onUpdateEquipment }: Readonly<EquipmentRequestProps>) {
  const [uploadErrors, setUploadErrors] = useState<{ [key: string]: string }>({});
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"office" | "delivery">("office");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingProof, setUploadingProof] = useState<{ [key: string]: boolean }>({});
  const [confirmingReceipt, setConfirmingReceipt] = useState<{ [key: string]: boolean }>({});

  const handleCheckboxChange = (onboardingItemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, onboardingItemId]);
    } else {
      setSelectedItems(selectedItems.filter(id => id !== onboardingItemId));
    }

    const updatedEquipment = equipment.map((item) => {
      if (item.onboarding_item_id === onboardingItemId) {
        return {
          ...item,
          is_requested: checked,
        };
      }
      return item;
    });
    onUpdateEquipment(updatedEquipment);
  };

  const handleOpenBulkDeliveryDialog = () => {
    if (selectedItems.length === 0) return;
    setDeliveryDialogOpen(true);
  };

  const handleBulkSubmitRequest = async () => {
    if (deliveryMethod === "delivery" && !deliveryAddress.trim()) {
      alert("Please provide a delivery address");
      return;
    }

    setSubmitting(true);
    try {
      const itemsToSubmit = equipment.filter(
        item => selectedItems.includes(item.onboarding_item_id) && item.is_requested
      );

      await Promise.all(
        itemsToSubmit.map(item =>
          requestEquipment(item.onboarding_item_id, true, deliveryMethod, deliveryMethod === 'delivery' ? deliveryAddress : undefined)
        )
      );

      const updatedEquipment = equipment.map((item) => {
        if (selectedItems.includes(item.onboarding_item_id) && item.is_requested) {
          return {
            ...item,
            status: "for-review" as const,
            delivery_method: deliveryMethod,
          };
        }
        return item;
      });

      onUpdateEquipment(updatedEquipment);
      setDeliveryDialogOpen(false);
      setDeliveryAddress("");
      setSelectedItems([]);
    } catch {
      alert("Failed to submit equipment request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProofUpload = async (onboardingItemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = validateFileUtil(file, ALLOWED_FILE_TYPES, "Invalid file type. Only PDF, JPG, PNG, DOC, and DOCX files are allowed.");
    if (error) {
      setUploadErrors({ ...uploadErrors, [onboardingItemId]: error });
      event.target.value = "";
      return;
    }

    setUploadErrors({ ...uploadErrors, [onboardingItemId]: "" });
    setUploadingProof(prev => ({ ...prev, [onboardingItemId]: true }));
    try {
      const submission = await uploadDocument(onboardingItemId, file, true);
      const updatedEquipment = equipment.map((item) => {
        if (item.onboarding_item_id === onboardingItemId) {
          return {
            ...item,
            proof_of_receipt: [...(item.proof_of_receipt || []), submission],
          };
        }
        return item;
      });
      onUpdateEquipment(updatedEquipment);
    } catch {
      setUploadErrors(prev => ({ ...prev, [onboardingItemId]: "Upload failed. Please try again." }));
    } finally {
      setUploadingProof(prev => ({ ...prev, [onboardingItemId]: false }));
      event.target.value = "";
    }
  };

  const handleConfirmReceipt = async (onboardingItemId: string) => {
    setConfirmingReceipt(prev => ({ ...prev, [onboardingItemId]: true }));
    try {
      await confirmTask(onboardingItemId);
      const updatedEquipment = equipment.map((item) => {
        if (item.onboarding_item_id === onboardingItemId && (item.proof_of_receipt?.length || 0) > 0) {
          return {
            ...item,
            status: "approved" as const,
          };
        }
        return item;
      });
      onUpdateEquipment(updatedEquipment);
    } catch {
      alert("Failed to confirm receipt. Please try again.");
    } finally {
      setConfirmingReceipt(prev => ({ ...prev, [onboardingItemId]: false }));
    }
  };

  const pendingSelectedCount = equipment.filter(
    item => selectedItems.includes(item.onboarding_item_id) && item.is_requested && (item.status === "pending" || item.status === "submitted")
  ).length;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[5%]">Request</TableHead>
            <TableHead className="w-[20%]">Equipment</TableHead>
            <TableHead className="w-[25%]">Description</TableHead>
            <TableHead className="w-[12%]">Delivery Method</TableHead>
            <TableHead className="w-[10%]">Status</TableHead>
            <TableHead className="w-[13%]">Proof of Receipt</TableHead>
            <TableHead className="w-[15%]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.map((item) => (
            <TableRow key={item.onboarding_item_id}>
              <TableCell>
                {(item.status === "pending" || item.status === "submitted") && (
                  <Checkbox
                    id={`equip-${item.onboarding_item_id}`}
                    checked={item.is_requested === true}
                    onCheckedChange={(checked) => handleCheckboxChange(item.onboarding_item_id, checked as boolean)}
                  />
                )}
                {(item.status === "for-review" || item.status === "issued" || item.status === "approved") && item.is_requested && (
                  <CheckCircle className="size-4 text-green-600" />
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    {item.is_required && <span className="text-red-600 font-bold">*</span>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-slate-600">{item.description}</span>
              </TableCell>
              <TableCell>
                {item.delivery_method ? (
                  <div className="flex items-center gap-1 text-sm">
                    {item.delivery_method === "office" ? (
                      <>
                        <MapPin className="size-3 text-blue-600" />
                        <span>Office Pickup</span>
                      </>
                    ) : (
                      <>
                        <Truck className="size-3 text-green-600" />
                        <span>Delivery</span>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusIcon status={item.status} />
                  <StatusBadge status={item.status} />
                </div>
              </TableCell>
              <TableCell>
                {item.status === "issued" && (
                  <div className="space-y-2">
                    {(item.proof_of_receipt?.length || 0) > 0 ? (
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-blue-600" />
                        <span className="text-sm">{item.proof_of_receipt?.length} file(s)</span>
                        {item.proof_of_receipt && item.proof_of_receipt.length > 0 && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 px-2">
                                <Eye className="size-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Proof of Receipt - {item.title}</DialogTitle>
                                <DialogDescription>Uploaded proof documents</DialogDescription>
                              </DialogHeader>
                              <ScrollArea className="max-h-100">
                                <div className="space-y-2">
                                  {item.proof_of_receipt.map((file) => (
                                    <div key={file.submission_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                                      <FileText className="size-6 text-blue-600" />
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{file.file_name}</p>
                                        <p className="text-xs text-slate-500">
                                          {formatFileSize(file.file_size_bytes)} • {new Date(file.uploaded_at).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={uploadingProof[item.onboarding_item_id]}
                          onClick={() => document.getElementById(`proof-${item.onboarding_item_id}`)?.click()}
                        >
                          <Upload className="size-3 mr-1" />
                          {uploadingProof[item.onboarding_item_id] ? "Uploading..." : "Upload"}
                        </Button>
                        <input
                          id={`proof-${item.onboarding_item_id}`}
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleProofUpload(item.onboarding_item_id, e)}
                        />
                      </>
                    )}
                  </div>
                )}
                {(item.status === "approved" && (item.proof_of_receipt?.length || 0) > 0) && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-600" />
                    <span className="text-sm text-green-600">Confirmed</span>
                  </div>
                )}
                {(item.status !== "issued" && item.status !== "approved") && (
                  <span className="text-sm text-slate-400">-</span>
                )}
              </TableCell>
              <TableCell>
                {item.status === "issued" && (item.proof_of_receipt?.length || 0) > 0 && (
                  <Button
                    onClick={() => handleConfirmReceipt(item.onboarding_item_id)}
                    size="sm"
                    variant="default"
                    disabled={confirmingReceipt[item.onboarding_item_id]}
                  >
                    {confirmingReceipt[item.onboarding_item_id] ? "Confirming..." : "Confirm Receipt"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delivery Method Dialog */}
      <Dialog open={deliveryDialogOpen} onOpenChange={(open) => !open && setDeliveryDialogOpen(false)}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle>Choose Delivery Method</DialogTitle>
            <DialogDescription>
              {pendingSelectedCount > 0 && (
                <span>Submitting {pendingSelectedCount} {pendingSelectedCount === 1 ? 'item' : 'items'}. </span>
              )}
              How would you like to receive this equipment?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label>Delivery Method</Label>

              <button
                type="button"
                className={`w-full text-left border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  deliveryMethod === "office"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => setDeliveryMethod("office")}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 size-5 rounded-full border-2 flex items-center justify-center ${
                    deliveryMethod === "office" ? "border-blue-500" : "border-slate-300"
                  }`}>
                    {deliveryMethod === "office" && (
                      <div className="size-2.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="size-4 text-blue-600" />
                      <span className="font-semibold">Claim in Office</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Pick up your equipment from our office location during business hours
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                className={`w-full text-left border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  deliveryMethod === "delivery"
                    ? "border-green-500 bg-green-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => setDeliveryMethod("delivery")}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 size-5 rounded-full border-2 flex items-center justify-center ${
                    deliveryMethod === "delivery" ? "border-green-500" : "border-slate-300"
                  }`}>
                    {deliveryMethod === "delivery" && (
                      <div className="size-2.5 rounded-full bg-green-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="size-4 text-green-600" />
                      <span className="font-semibold">Request Delivery</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Have the equipment delivered to your preferred address
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {deliveryMethod === "delivery" && (
              <div className="space-y-2">
                <Label htmlFor="delivery-address">Delivery Address *</Label>
                <Textarea
                  id="delivery-address"
                  placeholder="Enter your complete delivery address..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-slate-500">
                  Please provide a complete address including street, city, and postal code
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleBulkSubmitRequest} disabled={submitting}>
              {submitting ? "Submitting..." : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {Object.entries(uploadErrors).map(([equipId, error]) =>
        error && (
          <Alert key={equipId} variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )
      )}

      <RemarksSection remarks={remarks} />

      {pendingSelectedCount > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="size-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">
                {pendingSelectedCount} {pendingSelectedCount === 1 ? 'item' : 'items'} selected
              </p>
              <p className="text-xs text-blue-700">
                Submit your equipment requests to continue
              </p>
            </div>
          </div>
          <Button onClick={handleOpenBulkDeliveryDialog} size="lg">
            Submit Selected Items
          </Button>
        </div>
      )}

      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border">
        <strong>Note:</strong> When equipment status is "Issued", please upload proof of receipt (photo/document) and click "Confirm Receipt" to complete the process.
      </div>
    </div>
  );
}
