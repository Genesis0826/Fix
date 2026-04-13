import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default",
  rejected: "destructive",
  "for-review": "secondary",
  submitted: "outline",
  issued: "secondary",
  pending: "secondary",
  confirmed: "default",
};

const STATUS_LABELS: Record<string, string> = {
  "for-review": "For Review",
  issued: "Issued",
  confirmed: "Confirmed",
};

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "secondary"} className="whitespace-nowrap">
      {STATUS_LABELS[status] ?? (status.charAt(0).toUpperCase() + status.slice(1))}
    </Badge>
  );
}

export function DetailedStatusBadge({
  status,
  pendingLabel = "Pending",
}: Readonly<{ status: string; pendingLabel?: string }>) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-700">
          <AlertCircle className="size-3 mr-1" />
          {pendingLabel}
        </Badge>
      );
    case "submitted":
      return (
        <Badge variant="outline" className="bg-slate-900 text-white">
          <CheckCircle className="size-3 mr-1" />
          Submitted
        </Badge>
      );
    case "for-review":
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-800">
          <AlertCircle className="size-3 mr-1" />
          For Review
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="outline" className="bg-teal-100 text-teal-800">
          <CheckCircle className="size-3 mr-1" />
          Approved
        </Badge>
      );
    case "confirmed":
      return (
        <Badge variant="outline" className="bg-teal-100 text-teal-800">
          <CheckCircle className="size-3 mr-1" />
          Confirmed
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="outline" className="bg-red-100 text-red-800">
          <XCircle className="size-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-700">
          <AlertCircle className="size-3 mr-1" />
          {pendingLabel}
        </Badge>
      );
  }
}
