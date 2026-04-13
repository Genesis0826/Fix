"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getUserInfo, type StoredUser } from "@/lib/authStorage";
import { logoutApi } from "@/lib/authApi";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  LogOut,
  Users,
  UserPlus,
  DollarSign,
  BarChart,
  FileCheck,
  Layers,
  ClipboardCheck,
  Clock,
  Loader2,
  ScrollText,
  Trophy,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ROLE_LABELS: Record<string, string> = {
  hr: "HR Portal",
  manager: "Management Portal",
  employee: "Staff Portal",
  applicant: "Candidate Portal",
  admin: "Admin Portal",
  "system-admin": "System Admin",
};

type PersonaType = "applicant" | "employee" | "hr" | "manager" | "admin" | "system-admin";

const MENU_CONFIG: Record<PersonaType, { name: string; href: string; icon: any }[]> = {
  manager: [
    { name: "Dashboard", href: "/manager", icon: LayoutDashboard },
    { name: "Team", href: "/manager/team", icon: Users },
    { name: "Timekeeping", href: "/manager/timekeeping", icon: Clock },
    { name: "Approvals", href: "/manager/approvals", icon: ClipboardCheck },
  ],
  applicant: [
    { name: "Dashboard", href: "/applicant/dashboard", icon: LayoutDashboard },
    { name: "Jobs", href: "/applicant/jobs", icon: Briefcase },
    { name: "My Applications", href: "/applicant/applications", icon: FileText },
    { name: "My Profile", href: "/applicant/profile", icon: Users },
  ],
  employee: [
    { name: "Dashboard",   href: "/employee",              icon: LayoutDashboard },
    { name: "Timekeeping", href: "/employee/timekeeping",  icon: Clock },
    { name: "My Profile",  href: "/employee/profile",      icon: Users },
    { name: "Documents",   href: "/employee/documents",    icon: FileCheck },
  ],
  hr: [
    { name: "Dashboard",    href: "/hr",              icon: LayoutDashboard },
    { name: "Timekeeping",  href: "/hr/timekeeping",  icon: Clock },
    { name: "Recruitment",  href: "/hr/jobs",         icon: Briefcase },
    { name: "Candidates",   href: "/hr/candidates",   icon: Trophy },
    { name: "Onboarding",   href: "/hr/onboarding",   icon: UserPlus },
    { name: "Compensation", href: "/hr/payroll",      icon: DollarSign },
    { name: "Performance",  href: "/hr/performance",  icon: BarChart },
  ],
  admin: [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Users", href: "/admin/users", icon: Users },
  ],
  "system-admin": [
    { name: "Dashboard",      href: "/system-admin",                  icon: LayoutDashboard },
    { name: "Users",          href: "/system-admin/users",            icon: Users },
    { name: "Onboarding",     href: "/system-admin/onboarding",       icon: UserPlus },
    { name: "Timekeeping",    href: "/system-admin/timekeeping",      icon: Clock },
    { name: "Subscriptions",  href: "/system-admin/subscriptions",    icon: DollarSign },
    { name: "Audit Logs",     href: "/system-admin/audit-logs",       icon: ScrollText },
    { name: "Global Settings", href: "/system-admin/settings",        icon: ClipboardCheck },
  ],
};

export function Sidebar({
  persona = "applicant",
  additionalItems = [],
}: {
  readonly persona?: PersonaType;
  readonly additionalItems?: { name: string; href: string; icon: React.ElementType }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(getUserInfo());
  }, []);

  const handleLogout = async () => {
    if (user?.role === "applicant") {
      const { applicantLogoutApi } = await import("@/lib/authApi");
      await applicantLogoutApi();
      router.push("/applicant/login");
    } else {
      await logoutApi();
      router.push("/login");
    }
  };

  const ROOT_PATHS = new Set(["/system-admin", "/admin", "/hr", "/manager", "/employee"]);
  const linkStyle = (href: string) => {
    const isActive = ROOT_PATHS.has(href)
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
    return `flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm transition-all ${
      isActive
        ? "bg-sidebar-primary text-sidebar-foreground shadow-sm"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
    }`;
  };

  const currentMenu = [...(MENU_CONFIG[persona] || []), ...additionalItems];

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen shrink-0 border-r border-sidebar-border">

      {/* Logo Section */}
      <div className="h-16 flex items-center gap-3 px-6 mb-8 mt-4">
        <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shadow-inner shrink-0">
          <Layers className="h-6 w-6 text-sidebar-foreground" />
        </div>

        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight leading-none mb-1">
            Blue's Clues
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-sidebar-foreground/60 leading-none">
            HRIS
          </span>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 px-4 overflow-y-auto">
        <p className="text-[10px] font-bold text-sidebar-foreground/40 mb-3 px-2 tracking-widest uppercase">
          Main Menu
        </p>

        <nav className="space-y-1">
          {currentMenu.map((item) => (
            <Link key={item.href} href={item.href} className={linkStyle(item.href)}>
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Account Section */}
      <div className="mt-auto px-4 pb-4 border-t border-sidebar-border pt-4">
        <p className="text-[10px] font-bold text-sidebar-foreground/40 mb-3 px-2 tracking-widest uppercase">
          Account
        </p>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-3 px-3 py-2.5 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md font-medium text-sm w-full text-left transition-colors cursor-pointer">
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to log out?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                variant="destructive"
              >
                Log Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Profile Block */}
      <div className="bg-black/20 p-4 flex items-center gap-3">
        <div className="h-9 w-9 bg-primary/20 rounded-full flex items-center justify-center font-bold text-sm border border-white/10 text-sidebar-foreground">
          {user ? user.name.charAt(0) : <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate text-sidebar-foreground">
            {user?.name || "Loading..."}
          </p>
          <p className="text-[10px] text-sidebar-foreground/50 uppercase font-bold tracking-widest">
            {user ? (ROLE_LABELS[user.role] ?? user.role) : "Loading..."}
          </p>
        </div>
      </div>
    </div>
  );
}
