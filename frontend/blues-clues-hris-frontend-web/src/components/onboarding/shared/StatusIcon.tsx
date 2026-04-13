import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

export function StatusIcon({ status }: Readonly<{ status: string }>) {
  switch (status) {
    case "approved":
    case "confirmed":
      return <CheckCircle className="size-4 text-green-600" />;
    case "rejected":
      return <XCircle className="size-4 text-red-600" />;
    case "for-review":
      return <Clock className="size-4 text-orange-600" />;
    case "submitted":
      return <Clock className="size-4 text-blue-600" />;
    case "issued":
      return <AlertCircle className="size-4 text-purple-600" />;
    default:
      return <AlertCircle className="size-4 text-slate-400" />;
  }
}
