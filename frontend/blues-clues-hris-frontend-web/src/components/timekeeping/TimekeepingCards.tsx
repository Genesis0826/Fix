import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Clock, AlertCircle } from "lucide-react";
import type { TimekeepingStats } from "@/lib/timekeepingUtils";

// ─── StatCard ─────────────────────────────────────────────────────────────────
// Used in the top row of HR and Manager timekeeping pages

export function StatCard({ icon: Icon, label, value, sub, colorClass }: {
  readonly icon: any;
  readonly label: string;
  readonly value: string;
  readonly sub: string;
  readonly colorClass: string;
}) {
  return (
    <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className={`p-2 rounded-lg w-fit mb-3 ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <h2 className="text-2xl font-bold tracking-tight">{value}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─── SummaryCards ─────────────────────────────────────────────────────────────
// Bottom row summary used in both HR and Manager timekeeping pages

export function TimekeepingSummaryCards({ stats }: { readonly stats: TimekeepingStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

      <Card className="border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <TrendingUp className="h-4 w-4" />
            </div>
            <p className="font-semibold text-sm">Attendance Rate</p>
          </div>
          <p className="text-3xl font-bold mb-1">{stats.attendance_rate}%</p>
          <p className="text-xs text-muted-foreground mb-3">
            {stats.present + stats.late} of {stats.total} employees
          </p>
          <Progress value={stats.attendance_rate} className="h-2" />
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
            <p className="font-semibold text-sm">Average Hours</p>
          </div>
          <p className="text-3xl font-bold mb-1">{stats.avg_hours.toFixed(1)}h</p>
          <p className="text-xs text-muted-foreground mb-3">Per employee today</p>
          <Progress value={(stats.avg_hours / 8) * 100} className="h-2" />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">8h goal</p>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <AlertCircle className="h-4 w-4" />
            </div>
            <p className="font-semibold text-sm">Attendance Issues</p>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Late arrivals</span>
              <span className={`font-bold ${stats.late > 0 ? "text-amber-600" : "text-foreground"}`}>
                {stats.late}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Absences</span>
              <span className={`font-bold ${stats.absent > 0 ? "text-red-600" : "text-foreground"}`}>
                {stats.absent}
              </span>
            </div>
            <div className="border-t border-border pt-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Total issues</span>
              <span className={`font-bold ${(stats.late + stats.absent) > 0 ? "text-destructive" : "text-foreground"}`}>
                {stats.late + stats.absent}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
