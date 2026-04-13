"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "@/components/onboarding/WelcomeScreen";
import { OnboardingProcess } from "@/components/onboarding/OnboardingProcess";
import { ReviewScreen } from "@/components/onboarding/ReviewScreen";
import { CompletedScreen } from "@/components/onboarding/CompletedScreen";
import { NewHireApprovalForm } from "@/components/onboarding/NewHireApprovalForm";
import { OnboardingSession } from "@/types/onboarding.types";
import { getMySession, confirmTask } from "@/lib/onboardingApi";
import { getMyOnboarding } from "@/lib/authApi";

type Stage = "loading" | "new-hire-form" | "welcome" | "onboarding" | "review" | "completion" | "no-session";

export default function ApplicantOnboardingPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getMySession().catch((err: any) => {
        if (err?.status === 401) router.replace("/applicant/login?converted=true");
        return null;
      }),
      getMyOnboarding().catch(() => null),
    ]).then(([wizardSession, submission]) => {
      // If the applicant has a new-hire approval form that is not yet approved, show it first
      if (submission && submission.status !== "approved") {
        setStage("new-hire-form");
        return;
      }
      // Otherwise fall through to the 4-stage wizard session
      if (!wizardSession) { setStage("no-session"); return; }
      setSession(wizardSession);
      if (wizardSession.status === "approved") setStage("completion");
      else if (wizardSession.status === "for-review") setStage("review");
      else if (wizardSession.status === "in-progress" || wizardSession.status === "overdue" || wizardSession.progress_percentage > 0) setStage("onboarding");
      else {
        const welcomed = localStorage.getItem(`onboarding_welcome_done_${wizardSession.session_id}`);
        setStage(welcomed ? "onboarding" : "welcome");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = async (_skip: boolean) => {
    if (session?.session_id) localStorage.setItem(`onboarding_welcome_done_${session.session_id}`, "1");
    if (session?.welcome?.length) {
      const pending = session.welcome.filter(w => w.status === "pending");
      await Promise.all(pending.map(w => confirmTask(w.onboarding_item_id)));
      setSession(prev => prev ? { ...prev, welcome: prev.welcome.map(w => ({ ...w, status: "confirmed" as const })) } : prev);
    }
    setStage("onboarding");
  };

  if (stage === "loading") return <div className="p-8 text-muted-foreground animate-pulse">Loading onboarding data...</div>;

  if (stage === "new-hire-form") return <div className="w-full h-full animate-in fade-in duration-500"><NewHireApprovalForm /></div>;

  if (error || stage === "no-session") return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-2xl font-semibold text-slate-800">No Onboarding Assigned</h2>
        <p className="text-slate-600">{error || "Your onboarding session hasn't been set up yet. Please check back later or contact HR."}</p>
      </div>
    </div>
  );

  if (!session) return null;

  return (
    <div className="w-full h-full animate-in fade-in duration-500">
      {stage === "welcome" && <WelcomeScreen sessionId={session.session_id} onStart={handleStart} />}
      {stage === "onboarding" && <OnboardingProcess session={session} onUpdateSession={setSession} onComplete={() => setStage("review")} userRole="employee" />}
      {stage === "review" && <ReviewScreen />}
      {stage === "completion" && <CompletedScreen approvalDate={session.completed_at || new Date().toISOString()} onGoToDashboard={() => router.push("/applicant/dashboard")} />}
    </div>
  );
}
