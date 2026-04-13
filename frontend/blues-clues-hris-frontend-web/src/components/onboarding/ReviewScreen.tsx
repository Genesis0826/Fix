import { Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function ReviewScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-orange-100 p-6">
              <Clock className="size-16 text-orange-600 animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-3xl">Onboarding Under Review</CardTitle>
          <CardDescription className="text-lg">
            Great job completing all the requirements! Your onboarding submission is currently being reviewed by our HR
            team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Review Progress</span>
              <span className="font-medium">Processing...</span>
            </div>
            <Progress value={100} className="h-2" />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="size-5 text-blue-600" />
              What happens next?
            </h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">1.</span>
                <span>Our HR team will review all submitted documents and information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">2.</span>
                <span>You'll receive an email notification once the review is complete</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">3.</span>
                <span>If any additional information is needed, we'll contact you directly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">4.</span>
                <span>Typically, reviews are completed within 2-3 business days</span>
              </li>
            </ul>
          </div>

          <div className="text-center text-sm text-slate-500">
            <p>Please check your email regularly for updates.</p>
            <p className="mt-1">If you have urgent questions, contact hr@company.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
