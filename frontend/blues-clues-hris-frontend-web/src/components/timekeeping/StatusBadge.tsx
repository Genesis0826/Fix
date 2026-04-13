import { Badge } from "@/components/ui/badge";
export type { TimekeepingStatus } from "@/lib/timekeepingUtils";
import type { TimekeepingStatus } from "@/lib/timekeepingUtils";

const STATUS_CONFIG: Record<TimekeepingStatus, { label: string; className: string }> = {
  present:    { label: "Present",  className: "bg-green-100 hover:bg-green-100 text-green-700 border border-green-200" },
  absent:     { label: "Absent",   className: "bg-red-100 hover:bg-red-100 text-red-700 border border-red-200" },
  late:       { label: "Late",     className: "bg-amber-100 hover:bg-amber-100 text-amber-700 border border-amber-200" },
  "on-leave": { label: "On Leave", className: "bg-blue-100 hover:bg-blue-100 text-blue-700 border border-blue-200" },
};

export function TimekeepingStatusBadge({ status }: { readonly status: TimekeepingStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge className={`text-[9px] font-bold uppercase tracking-wide ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}
