"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { applicantLoginApi, applicantRegisterApi } from "@/lib/authApi";
import { setTokens, saveUserInfo, parseJwt, getAccessToken, getUserInfo } from "@/lib/authStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { GoogleSignInButton } from "@/components/ui/google-sign-in-button";
// TODO (Sprint 2): swap GoogleSignInButton for GoogleLogin once Client ID is available
// import { GoogleLogin } from "@react-oauth/google";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Briefcase, TrendingUp, AlertCircle, Loader2, Mail, UserCheck } from "lucide-react";

function ApplicantPortalAuthInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("converted") === "true") {
      setConvertedAccount(true);
      return;
    }
    const token = getAccessToken();
    const userInfo = getUserInfo();
    if (token && userInfo && userInfo.role === "applicant") {
      router.replace("/applicant/dashboard");
    }
  }, [router, searchParams]);

  const [isSignUp, setIsSignUp] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resentEmail, setResentEmail] = useState<string | null>(null);
  const [convertedAccount, setConvertedAccount] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResentEmail(null);
    setConvertedAccount(false);
    setIsLoading(true);

    try {
      const companyId = searchParams.get("company") ?? undefined;
      if (isSignUp) {
        await applicantRegisterApi(
          {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email,
            password,
            ...(phoneNumber.trim() ? { phone_number: phoneNumber.trim() } : {}),
          },
          companyId,
        );
        router.push(`/applicant/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      const { access_token } = await applicantLoginApi({ email, password, rememberMe });

        const payload = parseJwt(access_token);
        if (!payload) throw new Error("Invalid token received from server.");

        // If arriving from a specific company's careers page, block applicants
        // that belong to a different company from signing in here.
        if (companyId && payload.company_id && payload.company_id !== companyId) {
          throw new Error(
            "This account is registered with a different company. Please use your own company's careers page to sign in."
          );
        }

        setTokens({ access_token, rememberMe });

        const name = [payload.first_name ?? "", payload.last_name ?? ""]
          .filter(Boolean)
          .join(" ") || email;

        saveUserInfo({ name, email, role: "applicant" });

        // Soft navigation — keeps in-memory access token alive (no refresh cookie for applicants)
        const redirect = searchParams.get("redirect");
        router.push(redirect && redirect.startsWith("/applicant/") ? redirect : "/applicant/dashboard");
    } catch (err: any) {
      const msg: string = err?.message || "";
      if (msg.startsWith("UNVERIFIED_RESENT:")) {
        setResentEmail(email);
      } else if (msg.startsWith("CONVERTED_EMPLOYEE:")) {
        setConvertedAccount(true);
      } else {
        setError(msg || (isSignUp ? "Registration failed. Please try again." : "Invalid credentials. Please try again."));
      }
      setIsLoading(false);
    }
  };

  // TODO (Sprint 2 - Frontend): wire credentialResponse.credential to googleLoginApi()
  // once backend endpoint POST /api/tribeX/auth/v1/auth/google is ready.
  const handleGoogleSignIn = (_credentialResponse: any) => {
    setError("Google sign-in is not enabled yet in this environment.");
  };

  return (
    <div className="flex min-h-screen bg-muted/10 animate-in fade-in duration-500">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-1/2 relative overflow-hidden p-16"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #172554 52%, #134e4a 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-125 w-125 rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-175 w-175 rounded-full border border-white/3" />

        <div className="mb-auto relative z-10">
          {/* Brand mark */}
          <div className="flex items-center gap-3 mb-14">
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">Blue&apos;s Clues HRIS</p>
              <p className="text-white/50 text-[10px] uppercase tracking-widest mt-0.5">Applicant Portal</p>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight leading-snug">
            Find your next<br />
            <span className="text-emerald-400">opportunity.</span>
          </h1>
          <p className="text-white/60 mb-14 max-w-sm text-base leading-relaxed">
            Discover roles that match your skills and take the next step in your professional journey.
          </p>
          <div className="space-y-6">
            <FeatureItem icon={Search}     title="Explore Roles"     desc="Browse open positions tailored to your background." />
            <FeatureItem icon={Briefcase}  title="Track Applications" desc="Real-time updates on every submission you make." />
            <FeatureItem icon={TrendingUp} title="Grow With Us"       desc="Join a company that invests in your development." />
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between mt-12">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            © 2026 HR Information Systems Portal
          </p>
          <div className="flex gap-1.5">
            <span className="h-1.5 w-6 rounded-full bg-white/30" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-card/30">
        <div className="w-full max-w-md space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-5xl font-bold tracking-tight">Applicant Portal</h2>
            <p className="text-lg text-muted-foreground">
              {isSignUp ? "Create your candidate profile" : "Welcome back, please sign in"}
            </p>
          </div>

          {resentEmail && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  <strong>Verification email resent</strong> to <strong>{resentEmail}</strong>.
                  This email is registered but was never verified.
                </span>
              </div>
              <div className="pl-7">
                <Link
                  href={`/applicant/verify-email?email=${encodeURIComponent(resentEmail)}`}
                  className="text-blue-700 font-bold underline underline-offset-2 hover:text-blue-900"
                >
                  Go to verification page →
                </Link>
              </div>
            </div>
          )}

          {convertedAccount && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-3">
                <UserCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>You&apos;re now an official employee!</strong> Your applicant account has been converted.
                  Please log in through the employee portal.
                </span>
              </div>
              <div className="pl-7">
                <Link
                  href="/login"
                  className="text-emerald-700 font-bold underline underline-offset-2 hover:text-emerald-900"
                >
                  Go to Employee Login →
                </Link>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium p-4 rounded-xl flex items-center gap-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-xs font-medium p-4 rounded-xl">
              {successMsg}
            </div>
          )}

          {/* Google SSO Button */}
          {/* TODO (Sprint 2): replace GoogleSignInButton with GoogleLogin once Client ID is available */}
          {/* <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSignIn}
              onError={() => setError("Google sign-in failed. Please try again.")}
              useOneTap={false}
              text="signin_with_google"
              shape="rectangular"
              size="large"
              width="368"
            />
          </div> */}
          <GoogleSignInButton disabled={isLoading} onClick={() => setError("Google sign-in is not enabled yet in this environment.")} />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Sign In / Sign Up tabs */}
          <div className="flex p-1 bg-muted/60 rounded-xl border border-border">
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isSignUp ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setIsSignUp(false); setError(""); setSuccessMsg(""); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isSignUp ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setIsSignUp(true); setError(""); setSuccessMsg(""); }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {isSignUp && (
              <>
                <div className="flex gap-3">
                  <div className="space-y-2 flex-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">First Name</label>
                    <Input
                      type="text"
                      placeholder="John"
                      className="h-11 bg-background"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Last Name</label>
                    <Input
                      type="text"
                      placeholder="Doe"
                      className="h-11 bg-background"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                    Phone Number <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <Input
                    type="tel"
                    placeholder="+63 917 123 4567"
                    className="h-11 bg-background"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
              <Input
                type="email"
                placeholder="name@company.com"
                className="h-11 bg-background"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Security Password</label>
              <PasswordInput
                placeholder="••••••••"
                className="h-11 bg-background"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {!isSignUp && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="applicant-remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
                <label htmlFor="applicant-remember" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Remember me for 30 days
                </label>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg mt-2"
              disabled={isLoading}
            >
              {isLoading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : (isSignUp ? "Create Account →" : "Sign In to Portal →")
              }
            </Button>
          </form>

          <div className="text-center pt-4">
            <Link href="/login">
              <Button variant="ghost" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all">
                ← Internal Staff Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApplicantPortalAuth() {
  return (
    <Suspense>
      <ApplicantPortalAuthInner />
    </Suspense>
  );
}

function FeatureItem({ icon: Icon, title, desc }: any) {
  return (
    <div className="flex gap-4 group">
      <div className="bg-white/10 border border-white/10 p-2.5 rounded-xl h-fit shrink-0 transition-transform group-hover:scale-110">
        <Icon className="h-5 w-5 text-emerald-400" />
      </div>
      <div className="space-y-0.5">
        <h3 className="font-bold text-white text-sm leading-none">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed max-w-xs">{desc}</p>
      </div>
    </div>
  );
}
