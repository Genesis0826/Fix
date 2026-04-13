"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "@/components/onboarding/WelcomeScreen";
import { OnboardingProcess } from "@/components/onboarding/OnboardingProcess";
import { ReviewScreen } from "@/components/onboarding/ReviewScreen";
import { CompletedScreen } from "@/components/onboarding/CompletedScreen";
import { OnboardingSession } from "@/types/onboarding.types";
import { getMySession, confirmTask } from "@/lib/onboardingApi";

type OnboardingStage = "loading" | "welcome" | "onboarding" | "review" | "completion" | "no-session";

export default function ApplicantOnboardingPage() {
  const router = useRouter();
  const routerRef = useRef(router);
  const [stage, setStage] = useState<OnboardingStage>("loading");
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMySession()
      .then((data) => {
        if (!data) {
          setStage("no-session");
          return;
        }
        setSession(data);
        if (data.status === "approved") {
          setStage("completion");
        } else if (data.status === "for-review") {
          setStage("review");
        } else if (data.status === "in-progress" || data.status === "overdue" || data.progress_percentage > 0) {
          setStage("onboarding");
        } else {
          // Check if user already dismissed the welcome screen for this session
          const welcomed = localStorage.getItem(`onboarding_welcome_done_${data.session_id}`);
          setStage(welcomed ? "onboarding" : "welcome");
        }
      })
      .catch((err: any) => {
        if (err?.status === 401) {
          router.replace('/applicant/login?converted=true');
          return;
        }
        setError("Failed to load onboarding data.");
        setStage("no-session");
      });
  }, []);

  const handleStart = async (_dontShowAgain: boolean) => {
    // Always mark welcome as done so it never flashes on reload
    if (session?.session_id) {
      localStorage.setItem(`onboarding_welcome_done_${session.session_id}`, "1");
    }
    if (session?.welcome && session.welcome.length > 0) {
      const pending = session.welcome.filter((w) => w.status === "pending");
      await Promise.all(pending.map((w) => confirmTask(w.onboarding_item_id)));
      setSession((prev) =>
        prev
          ? { ...prev, welcome: prev.welcome.map((w) => ({ ...w, status: "confirmed" as const })) }
          : prev,
      );
    }
    setStage("onboarding");
  };

  const handleComplete = () => {
    setStage("review");
  };

  const handleUpdateSession = (updatedSession: OnboardingSession) => {
    setSession(updatedSession);
  };

  const handleGoToDashboard = () => {
    router.push("/applicant/dashboard");
  };

  if (stage === "loading") {
    return (
      <div className="p-8 text-muted-foreground animate-pulse">
        Loading onboarding data...
      </div>
    );
  }

  if (error || stage === "no-session") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-semibold text-slate-800">No Onboarding Assigned</h2>
          <p className="text-slate-600">
            {error ||
              "Your onboarding session hasn't been set up yet. This may happen shortly after you are hired. Please check back later or contact HR."}
          </p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="w-full h-full animate-in fade-in duration-500">
      {stage === "welcome" && (
        <WelcomeScreen
          sessionId={session.session_id}
          onStart={handleStart}
        />
      )}

      {stage === "onboarding" && (
        <OnboardingProcess
          session={session}
          onUpdateSession={handleUpdateSession}
          onComplete={handleComplete}
          userRole="employee"
        />
      )}

      {stage === "review" && <ReviewScreen />}

      {stage === "completion" && (
        <CompletedScreen
          approvalDate={session.completed_at || new Date().toISOString()}
          onGoToDashboard={handleGoToDashboard}
        />
      )}
    </div>
  );
}
