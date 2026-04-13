import { LogOut, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmployeeOffboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-slate-100 p-6">
              <LogOut className="size-16 text-slate-400" />
            </div>
          </div>
          <CardTitle className="text-3xl">Offboarding</CardTitle>
          <CardDescription className="text-lg">
            This section is not yet available. Please check back later or contact your HR officer for assistance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center gap-3 text-slate-500">
            <Clock className="size-5 shrink-0" />
            <p className="text-sm">Offboarding features are coming soon.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
