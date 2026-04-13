"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, parseJwt, clearAuthStorage } from "@/lib/authStorage";
import { refreshApi } from "@/lib/authApi";
import { roleToPath } from "@/lib/roleMap";

type Props = {
  readonly children: React.ReactNode;
  readonly allowedRoles?: string[]; // role_name list (ex: ["Active Employee"])
};

export default function AuthGuard({ children, allowedRoles }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      let access = getAccessToken();

      // Token lost from memory (e.g. page refresh) — try silent refresh via HttpOnly cookie
      if (!access) {
        try {
          const result = await refreshApi();
          access = result.access_token;
        } catch {
          clearAuthStorage();
          router.replace("/login");
          return;
        }
      }

      const decoded = parseJwt(access);
      const roleName = decoded?.role_name as string | undefined;

      // token broken => login
      if (!roleName) {
        clearAuthStorage();
        router.replace("/login");
        return;
      }

      // role check (optional)
      if (allowedRoles && !allowedRoles.includes(roleName)) {
        // send them to their correct dashboard
        router.replace(roleToPath(roleName));
        return;
      }

      setReady(true);
    })();
  }, [router, allowedRoles]);

  if (!ready) return null; // or a spinner

  return <>{children}</>;
}
