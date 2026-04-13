"use client";

import { useState, useLayoutEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearAuthStorage, saveUserInfo, getAccessToken, parseJwt } from "@/lib/authStorage";
import { authFetch, logoutApi } from "@/lib/authApi";
import { useIdleTimeout } from "@/lib/useIdleTimeout";
import { API_BASE_URL } from "@/lib/api";
import { roleToPath } from "@/lib/roleMap";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type UserRole = "hr" | "manager" | "employee" | "applicant" | "admin" | "system-admin";

export default function SharedDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const handleIdle = useCallback(async () => {
    await logoutApi();
    router.replace("/login");
  }, [router]);

  useIdleTimeout(handleIdle, !!role);

  useLayoutEffect(() => {
    const verify = async () => {
      // Block children only when the token is missing or expired.
      // If the token is still valid, keep children visible and verify silently
      // in the background — this avoids a blank flash on every navigation.
      const token = getAccessToken();
      const payload = token ? parseJwt(token) : null;
      const needsRefresh = !payload?.exp || Date.now() / 1000 >= payload.exp - 30;
      if (needsRefresh) setIsAuthorized(false);

      const res = await authFetch(`${API_BASE_URL}/me`);
      if (!res.ok) {
        clearAuthStorage();
        router.replace("/login");
        return;
      }

      const me = await res.json();
      if (!me?.role_name) {
        clearAuthStorage();
        router.replace("/login");
        return;
      }

      const rolePath = roleToPath(me.role_name); // e.g. "/system-admin"
      const rawRole = rolePath.replaceAll("/", "");
      const userRole = rawRole as UserRole;

      // Strict Persona Guard: prevents a Manager from viewing /hr pages, etc.
      const isAccessingWrongDashboard =
        (pathname.startsWith("/hr") && userRole !== "hr") ||
        (pathname.startsWith("/manager") && userRole !== "manager") ||
        (pathname.startsWith("/employee") && userRole !== "employee") ||
        (pathname.startsWith("/applicant") && userRole !== "applicant") ||
        (pathname.startsWith("/system-admin") && userRole !== "system-admin") ||
        (pathname.startsWith("/admin") && userRole !== "admin");

      if (isAccessingWrongDashboard) {
        router.replace(rolePath);
        return;
      }

      // overwrite user_info with real server data — corrects any DevTools edits
      const tokenPayload = parseJwt(getAccessToken() ?? "");
      const firstName = tokenPayload?.first_name ?? "";
      const lastName = tokenPayload?.last_name ?? "";
      const name = [firstName, lastName].filter(Boolean).join(" ") || me.username || "";
      saveUserInfo({ name, email: me.email ?? "", role: userRole });

      setRole(userRole);
      setIsAuthorized(true);
    };

    verify();
  }, [pathname, router]);

  if (!isAuthorized || !role) {
    return null;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar persona={role} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar persona={role} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
