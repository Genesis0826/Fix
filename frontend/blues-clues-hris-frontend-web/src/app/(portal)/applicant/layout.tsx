"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/authStorage";
import { applicantRefreshApi, applicantLogoutApi, getMyOnboarding } from "@/lib/authApi";
import { getMySession } from "@/lib/onboardingApi";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Briefcase, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";

const APPLICANT_MENU = [
  { name: "Dashboard",    href: "/applicant/dashboard",    icon: LayoutDashboard },
  { name: "Jobs",         href: "/applicant/jobs",         icon: Briefcase },
  { name: "Applications", href: "/applicant/applications", icon: FileText },
  { name: "My Profile",   href: "/applicant/profile",      icon: Users },
];

const ONBOARDING_ITEM = {
  name: "Onboarding",
  href: "/applicant/onboarding",
  icon: ClipboardList,
};

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = pathname.includes("/login") || pathname.includes("/verify-email");
  const [ready, setReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);

  const visibleMenu = useMemo(() => {
    return onboardingVisible ? [...APPLICANT_MENU, ONBOARDING_ITEM] : APPLICANT_MENU;
  }, [onboardingVisible]);

  const activeHref = useMemo(() => {
    const hit = visibleMenu.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
    return hit?.href ?? "/applicant/dashboard";
  }, [pathname, visibleMenu]);

  useLayoutEffect(() => {
    if (isPublicPage) {
      setReady(true);
      return;
    }

    const init = async () => {
      if (!getAccessToken()) {
        try {
          await applicantRefreshApi();
        } catch {
          router.replace(`/applicant/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }
      }
      setReady(true);
      // Show Onboarding tab if applicant has a wizard session OR an old-style submission
      Promise.all([
        getMySession().catch((err: any) => {
          if (err?.status === 401) {
            router.replace('/applicant/login?converted=true');
          }
          return null;
        }),
        getMyOnboarding().catch(() => null),
      ]).then(([session, record]) => {
        if (session || record) setOnboardingVisible(true);
      });
    };

    init();
  }, [isPublicPage, router]);

  const handleMobileLogout = async () => {
    await applicantLogoutApi();
    setMobileMenuOpen(false);
    router.push("/applicant/login");
  };

  if (isPublicPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (!ready) return null;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <div className="hidden md:block">
        <Sidebar
          persona="applicant"
          additionalItems={onboardingVisible ? [ONBOARDING_ITEM] : []}
        />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu overlay"
          />
          <aside className="absolute left-0 top-0 h-full w-[82%] max-w-xs bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-4">
            <div className="flex items-center justify-between pb-4 border-b border-sidebar-border">
              <p className="text-sm font-bold tracking-wide">Candidate Portal</p>
              <button
                type="button"
                className="h-9 w-9 rounded-md border border-sidebar-border flex items-center justify-center"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="pt-4 space-y-1.5">
              {visibleMenu.map((item) => {
                const ItemIcon = item.icon;
                const isActive = activeHref === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-sidebar-primary text-sidebar-foreground"
                        : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <ItemIcon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleMobileLogout}
              className="mt-6 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-sidebar-border text-sm font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </aside>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="hidden md:block">
          <Topbar persona="applicant" />
        </div>

        <header className="md:hidden h-14 px-3 border-b border-border bg-background/95 backdrop-blur flex items-center justify-between">
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-border flex items-center justify-center"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold tracking-tight">Applicant Portal</p>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Blue&apos;s Clues</span>
        </header>

        <main className="flex-1 overflow-y-auto p-3 md:p-8 bg-muted/10 pb-20 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur">
          <div className={`grid gap-1 px-2 py-2 ${onboardingVisible ? "grid-cols-5" : "grid-cols-4"}`}>
            {visibleMenu.map((item) => {
              const ItemIcon = item.icon;
              const isActive = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center rounded-md py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    isActive ? "text-primary bg-primary/10" : "text-muted-foreground"
                  }`}
                >
                  <ItemIcon className="h-4 w-4 mb-0.5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
