import { UserRole } from "../services/auth";

export const MENU_CONFIG: Record<UserRole, { name: string; label: string }[]> = {
  hr: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Timekeeping", label: "Timekeeping" },
    { name: "Recruitment", label: "Recruitment" },
  ],
  manager: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Timekeeping", label: "Timekeeping Logs" },
    { name: "Team", label: "Team" },
  ],
  employee: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Timekeeping", label: "Timekeeping" },
  ],
  applicant: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Jobs", label: "Browse Jobs" },
    { name: "Applications", label: "My Applications" },
  ],
  system_admin: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Users", label: "Users" },
    { name: "AuditLogs", label: "Audit Logs" },
    { name: "Billing", label: "Billing" },
  ],
  admin: [
    { name: "Dashboard", label: "Dashboard" },
    { name: "Users", label: "Users" },
    { name: "AuditLogs", label: "Audit Logs" },
    { name: "Billing", label: "Billing" },
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  hr: "HR Portal",
  manager: "Management Portal",
  employee: "Staff Portal",
  applicant: "Candidate Portal",
  system_admin: "System Admin",
  admin: "Admin",
};

export const SEARCH_PLACEHOLDERS: Record<UserRole, string> = {
  hr: "Search employees...",
  manager: "Search timekeeping logs...",
  employee: "Search...",
  applicant: "Search jobs...",
  system_admin: "Search...",
  admin: "Search...",
};

export const APP_NAME = "Blue's Clues";
export const APP_SUBTITLE = "HRIS";