"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";
import { applicantResendVerificationApi } from "@/lib/authApi";

type VerifyState = "pending" | "loading" | "success" | "error";
type ResendState = "idle" | "loading" | "sent" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [state, setState] = useState<VerifyState>(token ? "loading" : "pending");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resendState, setResendState] = useState<ResendState>("idle");
  const [resendError, setResendError] = useState<string>("");

  const handleResend = async () => {
    if (!email) return;
    setResendState("loading");
    setResendError("");
    try {
      await applicantResendVerificationApi(email);
      setResendState("sent");
    } catch (err: any) {
      setResendError(err?.message || "Failed to resend. Please try again.");
      setResendState("error");
    }
  };

  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE_URL}/applicants/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setState("success");
        } else {
          const body = await res.json().catch(() => ({}));
          setErrorMessage(body.message ?? "Verification failed. Please try again.");
          setState("error");
        }
      })
      .catch(() => {
        setErrorMessage("Could not reach the server. Please check your connection.");
        setState("error");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-6">
          <p className="text-sm font-semibold tracking-widest text-primary uppercase">
            Blue&apos;s Clues HRIS
          </p>
          <p className="text-xs text-muted-foreground mt-1">Applicant Portal</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center space-y-6">
          {state === "pending" && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-9 w-9 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  Check your email
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We sent a verification link to{" "}
                  {email ? <span className="font-medium text-foreground">{email}</span> : "your email address"}.
                  Click the link to activate your account.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/applicant/login")}
              >
                Back to Sign In
              </Button>
            </>
          )}

          {state === "loading" && (
            <>
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground">
                  Verifying your email...
                </h1>
                <p className="text-sm text-muted-foreground">
                  Please wait a moment.
                </p>
              </div>
            </>
          )}

          {state === "success" && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  Email Verified!
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your account is now active. You can sign in to your
                  applicant portal and start tracking your applications.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push("/applicant/login")}
              >
                Go to Sign In
              </Button>
            </>
          )}

          {state === "error" && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-9 w-9 text-destructive" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  Verification Failed
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {errorMessage || "This link is invalid, expired, or has already been used."}
                </p>
              </div>

              {/* Resend option — only shown when we know the email */}
              {email && resendState !== "sent" && (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    disabled={resendState === "loading"}
                    onClick={handleResend}
                  >
                    {resendState === "loading" ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                    ) : (
                      <><Mail className="h-4 w-4 mr-2" /> Resend Verification Email</>
                    )}
                  </Button>
                  {resendState === "error" && (
                    <p className="text-xs text-destructive text-center">{resendError}</p>
                  )}
                </div>
              )}

              {resendState === "sent" && (
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
                  <p className="text-sm text-green-700 dark:text-green-400 text-center">
                    A new verification link has been sent to <span className="font-medium">{email}</span>. Check your inbox.
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/applicant/login")}
              >
                Back to Sign In
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
