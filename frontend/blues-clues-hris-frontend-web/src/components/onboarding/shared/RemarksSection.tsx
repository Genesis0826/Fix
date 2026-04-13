import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Remark } from "@/types/onboarding.types";

interface RemarksSectionProps {
  remarks: Remark[];
}

export function RemarksSection({ remarks }: Readonly<RemarksSectionProps>) {
  const sortedRemarks = [...remarks].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sortedRemarks.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          Remarks & Feedback
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-75">
          <div className="space-y-3">
            {sortedRemarks.map((remark) => (
              <div key={remark.remark_id} className="p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{remark.author}</span>
                    <Badge variant="outline" className="text-xs">
                      {remark.tab_tag}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(remark.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{remark.remark_text}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
