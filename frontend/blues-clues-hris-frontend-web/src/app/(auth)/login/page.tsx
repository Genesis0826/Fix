"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginApi, authFetch, refreshApi } from "@/lib/authApi";
import { setTokens, saveUserInfo, parseJwt, clearAuthStorage, getRememberMe, getUserInfo } from "@/lib/authStorage";
import { API_BASE_URL } from "@/lib/api";
import { roleToPath } from "@/lib/roleMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { GoogleSignInButton } from "@/components/ui/google-sign-in-button";
import { AlertCircle, Loader2, Clock, Users, Shield } from "lucide-react";

export default function EmployeeLoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getRememberMe()) return;
    const userInfo = getUserInfo();
    if (!userInfo || userInfo.role === "applicant") return;
    refreshApi()
      .then(() => router.replace(`/${userInfo.role}`))
      .catch(() => clearAuthStorage());
  }, [router]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const { access_token } = await loginApi({ identifier, password, rememberMe });
      setTokens({ access_token, rememberMe });
      const payload = parseJwt(access_token);
      if (!payload) throw new Error("Invalid token received from server.");
      const rolePath = roleToPath(payload.role_name);
      if (rolePath === "/login") throw new Error(`Unknown role: ${payload.role_name}`);
      const role = rolePath.replaceAll("/", "");
      if (role === "applicant") {
        setError("Applicants must use the Candidate Portal.");
        setIsLoading(false);
        return;
      }
      const meRes = await authFetch(`${API_BASE_URL}/me`);
      const me = await meRes.json().catch(() => ({}));
      const name = [payload.first_name ?? "", payload.last_name ?? ""].filter(Boolean).join(" ") || me.username || identifier;
      saveUserInfo({ name, email: me.email ?? "", role });
      router.push(`/${role}`);
    } catch (err: any) {
      setError(err?.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen bg-muted/10 animate-in fade-in duration-500">

      {/* Left panel — gradient hero */}
      <div className="hidden lg:flex flex-col w-1/2 relative overflow-hidden p-16"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #172554 52%, #134e4a 100%)" }}>
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-125 w-125 rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-175 w-175 rounded-full border border-white/3" />

        <div className="mb-auto relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">Blue&apos;s Clues HRIS</p>
              <p className="text-white/50 text-[10px] uppercase tracking-widest mt-0.5">Internal Staff Portal</p>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight leading-snug">
            Your workspace,<br />
            <span className="text-emerald-400">always accessible.</span>
          </h1>
          <p className="text-white/60 mb-14 max-w-sm text-base leading-relaxed">
            Timekeeping, HR tools, and team management — everything you need, in one secure platform.
          </p>

          <div className="space-y-6">
            <FeatureItem icon={Clock}  title="Track Your Time"    desc="Log attendance, view your schedule, and stay compliant." />
            <FeatureItem icon={Users}  title="Team Collaboration" desc="Coordinate seamlessly with HR, managers, and teammates." />
            <FeatureItem icon={Shield} title="Role-Based Access"  desc="Secure, scoped access — you see exactly what matters to you." />
          </div>
        </div>

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

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-card/30">
        <div className="w-full max-w-md space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-5xl font-bold tracking-tight">Staff Portal</h2>
            <p className="text-lg text-muted-foreground">Welcome back, please sign in</p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium p-4 rounded-xl flex items-center gap-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <GoogleSignInButton disabled={isLoading} onClick={() => {}} />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="login-identifier" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                Email or Username
              </label>
              <Input
                id="login-identifier"
                type="text"
                placeholder="name@company.com or username"
                className="h-11 bg-background"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                Security Password
              </label>
              <PasswordInput
                id="login-password"
                placeholder="••••••••"
                className="h-11 bg-background"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Remember me</span>
              </label>
              <Link href="/forgot-password"
                className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg mt-2"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In to Portal →"}
            </Button>
          </form>

          <div className="text-center pt-4 space-y-3">
            <div>
              <Link href="/applicant/login">
                <Button variant="ghost"
                  className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all">
                  Applicant Portal →
                </Button>
              </Link>
            </div>
            <div>
              <Link href="/subscribe" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                New Company? Subscribe Now
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function FeatureItem({ icon: Icon, title, desc }: { readonly icon: React.ElementType; readonly title: string; readonly desc: string }) {
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
