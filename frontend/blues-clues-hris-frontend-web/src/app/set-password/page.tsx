"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2, KeyRound } from "lucide-react";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword]         = useState("");
  const [confirmPassword, setConfirmPassword]   = useState("");
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState(false);
  const [isLoading, setIsLoading]       = useState(false);

  useEffect(() => {
    if (!token) setError("Invalid or missing invite link. Please contact your administrator.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Something went wrong.");

      setSuccess(true);
      setTimeout(() => router.replace("/login"), 3000);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center pb-6">
          <div className="flex flex-col items-center mb-4">
            <span className="text-xl font-bold tracking-tight text-primary">
              Blue's Clues
            </span>
            <span className="text-sm font-bold text-primary mt-1">
              HR Information Systems
            </span>
          </div>

          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
          </div>

          <CardTitle className="text-2xl font-bold">Set Your Password</CardTitle>
          <CardDescription>
            Create a password to activate your account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success */}
          {success ? (
            <div className="bg-green-500/10 border border-green-500/20 text-green-700 text-sm p-4 rounded-md flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Account activated!</p>
                <p className="text-xs mt-0.5">Redirecting you to login...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-semibold">New Password</label>
                <PasswordInput
                  id="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || !token}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-semibold">Confirm Password</label>
                <PasswordInput
                  id="confirm-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading || !token}
                  required
                />
              </div>

              {/* Password strength hint */}
              <p className="text-[11px] text-muted-foreground">
                Use at least 8 characters with a mix of letters and numbers.
              </p>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm mt-2"
                disabled={isLoading || !token}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Activating account...
                  </>
                ) : (
                  "Activate Account →"
                )}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-3 pt-6 border-t border-border bg-muted/30 rounded-b-xl">
          <p className="text-xs text-muted-foreground text-center">
            This link has a limited validity period. Contact your administrator if it has expired.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
