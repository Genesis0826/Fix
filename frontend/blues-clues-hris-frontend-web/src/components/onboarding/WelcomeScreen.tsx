"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WelcomeScreenProps {
  sessionId: string;
  onStart: (dontShowAgain: boolean) => void;
}

export function WelcomeScreen({ sessionId, onStart }: Readonly<WelcomeScreenProps>) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    if (dontShowAgain) {
      localStorage.setItem(`onboarding_welcome_done_${sessionId}`, "1");
    }
    await onStart(dontShowAgain);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-blue-100 p-6">
              <PartyPopper className="size-16 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-3xl">Congratulations!</CardTitle>
          <CardDescription className="text-lg">
            Welcome to the team! We&apos;re excited to have you on board. Let&apos;s get you started with the onboarding process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2">What to expect:</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Complete necessary documentation and forms</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Upload required documents with validation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Review and acknowledge company policies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Request necessary equipment and resources</span>
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="dont-show-again"
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
            />
            <label htmlFor="dont-show-again" className="text-xs text-muted-foreground cursor-pointer select-none">
              Don&apos;t show this welcome screen again
            </label>
          </div>

          <Button onClick={handleStart} disabled={starting} className="w-full" size="lg">
            {starting ? "Starting..." : "Start Onboarding Process"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
