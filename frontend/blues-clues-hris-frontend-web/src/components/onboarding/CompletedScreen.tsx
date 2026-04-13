import { CheckCircle, Calendar, Download, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CompletedScreenProps {
  readonly approvalDate: string | Date;
  readonly onGoToDashboard?: () => void;
}

export function CompletedScreen({ approvalDate, onGoToDashboard }: CompletedScreenProps) {
  const date = typeof approvalDate === 'string' ? new Date(approvalDate) : approvalDate;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-6">
              <CheckCircle className="size-16 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-3xl">Onboarding Completed!</CardTitle>
          <CardDescription className="text-lg">
            Congratulations! Your onboarding has been approved and completed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Calendar className="size-5 text-green-600" />
              <span className="font-semibold text-green-900">Approved on</span>
            </div>
            <p className="text-2xl font-bold text-green-700">
              {date.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Next Steps:</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Check your email for your first day schedule and orientation details</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Your equipment request has been processed and will be ready on your start date</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>You'll receive access credentials to company systems within 24 hours</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Welcome packet and employee handbook are available for download</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="flex-1">
              <Download className="size-4 mr-2" />
              Download Documents
            </Button>
            <Button variant="outline" className="flex-1" onClick={onGoToDashboard}>
              <Home className="size-4 mr-2" />
              Go to Dashboard
            </Button>
          </div>

          <div className="text-center text-sm text-slate-500">
            <p>Welcome to the team! We're excited to have you on board.</p>
            <p className="mt-1">For any questions, contact hr@company.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
