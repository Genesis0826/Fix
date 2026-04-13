import { authFetch } from "./authApi";
import { API_BASE_URL } from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND TEAM: All functions below have a mock return for development.
// When an endpoint is ready, replace the mock block with the commented-out
// authFetch call directly above it. Nothing else needs to change.
//
// Base URL resolves from NEXT_PUBLIC_API_BASE_URL in .env
// All requests are authenticated via authFetch (handles token + silent refresh)
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_URL = `${API_BASE_URL}/admin`;

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserStatus = "active" | "pending" | "locked";

export type UserRole =
  | "HR Officer"
  | "HR Recruiter"
  | "HR Interviewer"
  | "Active Employee"
  | "Manager"
  | "Group Head"
  | "Admin";

export interface InternalUser {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  role: UserRole;
  department: string;
  company: string;
  start_date: string;        // ISO date string
  status: UserStatus;
  last_login: string | null; // ISO datetime, null if never logged in
  signup_link_expires_at: string | null;
}

export interface UserStats {
  total: number;
  active: number;
  pending: number;
  locked: number;
}

export interface Company {
  company_id: string;
  name: string;
}

export interface CreateUserPayload {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  role: UserRole;
  department: string;
  company_id: string;
  start_date: string;        // ISO date string
  link_expiry_hours: number; // 24 | 48 | 72
}

export interface CreateUserResponse {
  user: InternalUser;
  signup_link: string;
  expires_at: string; // ISO datetime
}

// ─── Users ────────────────────────────────────────────────────────────────────

// GET /admin/users
export async function getUsers(): Promise<InternalUser[]> {
  return [
    { user_id: "u1", employee_id: "EMP-0001", first_name: "Sarah", last_name: "Miller", username: "sarah.miller", email: "sarah@company.com", role: "HR Officer", department: "Human Resources", company: "Blue's Clues Inc.", start_date: "2024-01-15", status: "active", last_login: "2026-03-10T10:32:00Z", signup_link_expires_at: null },
    { user_id: "u2", employee_id: "EMP-0002", first_name: "John", last_name: "Doe", username: "john.doe", email: "john@company.com", role: "Active Employee", department: "Engineering", company: "Blue's Clues Inc.", start_date: "2026-03-15", status: "pending", last_login: null, signup_link_expires_at: "2026-03-12T10:00:00Z" },
    { user_id: "u3", employee_id: "EMP-0003", first_name: "Jane", last_name: "Smith", username: "jane.smith", email: "jane@company.com", role: "Manager", department: "Operations", company: "Blue's Clues Inc.", start_date: "2023-06-01", status: "locked", last_login: "2026-02-20T08:15:00Z", signup_link_expires_at: null },
  ];
}

// GET /admin/users/stats
export async function getUserStats(): Promise<UserStats> {
  return { total: 3, active: 1, pending: 1, locked: 1 };
}

// POST /users — System Admin must include company_id in the body; backend derives it from JWT for Admin
export async function createUser(payload: CreateUserPayload): Promise<CreateUserResponse> {
  const res = await authFetch(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      first_name: payload.first_name,
      last_name: payload.last_name,
      username: payload.username,
      email: payload.email,
      role_id: payload.role,
      company_id: payload.company_id,
      ...(payload.department ? { department_id: payload.department } : {}),
      ...(payload.start_date ? { start_date: payload.start_date } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to create user");

  // Backend returns { user_id, employee_id, email, username } — map to InternalUser shape
  const expires = new Date(Date.now() + payload.link_expiry_hours * 3600 * 1000).toISOString();
  return {
    user: {
      user_id: data.user_id,
      employee_id: data.employee_id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      username: data.username,
      email: data.email,
      role: payload.role,
      department: payload.department,
      company: payload.company_id,
      start_date: payload.start_date,
      status: "pending",
      last_login: null,
      signup_link_expires_at: expires,
    },
    signup_link: "",   // backend sends the link via email; no link returned in API response
    expires_at: expires,
  };
}

// PATCH /admin/users/:id/status — body: { status: "active" | "locked" }
export async function setUserStatus(userId: string, status: "active" | "locked"): Promise<void> {
  // TODO: implement PATCH /admin/users/:id/status
  void userId; void status;
}

// PATCH /admin/users/:id — editable fields: role, department, start_date
export async function updateUser(
  userId: string,
  payload: Partial<Pick<InternalUser, "role" | "department" | "start_date">>
): Promise<void> {
  // TODO: implement PATCH /admin/users/:id
  void userId; void payload;
}

// POST /admin/users/:id/resend-link — body: { link_expiry_hours }
export async function resendSignupLink(
  userId: string,
  expiryHours: number
): Promise<{ signup_link: string; expires_at: string }> {
  const expires = new Date(Date.now() + expiryHours * 3600 * 1000).toISOString();
  return {
    signup_link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/set-password?token=mock-token-${Date.now()}`,
    expires_at: expires,
  };
}

// ─── Companies ────────────────────────────────────────────────────────────────

// GET /admin/companies
export async function getCompanies(): Promise<Company[]> {
  return [
    { company_id: "c1", name: "Blue's Clues Inc." },
    { company_id: "c2", name: "Acme Corporation" },
  ];
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export type SubscriptionStatus = "active" | "trial" | "expired" | "cancelled";
export type PlanTier = "Starter" | "Professional" | "Enterprise";

export interface Subscription {
  subscription_id: string;
  company_id: string;
  company_name: string;
  plan: PlanTier;
  amount: number;        // monthly USD
  status: SubscriptionStatus;
  next_renewal: string;  // ISO date
  mrr: number;           // 0 if trial/expired
  seats_used: number;
  seats_limit: number;
}

export interface PlanConfig {
  plan: PlanTier;
  price: number;
  seats: number;
  features: string[];
}

export interface BillingStats {
  total_mrr: number;
  active_subscriptions: number;
  trial_accounts: number;
  expiring_soon: number; // renewals within 7 days
}

// GET /admin/subscriptions
export async function getSubscriptions(): Promise<Subscription[]> {
  return [
    { subscription_id: "sub-1", company_id: "c1", company_name: "Blue's Clues Inc.", plan: "Enterprise", amount: 4999, status: "active", next_renewal: "2026-04-15", mrr: 4999, seats_used: 342, seats_limit: 500 },
    { subscription_id: "sub-2", company_id: "c2", company_name: "Acme Corporation", plan: "Professional", amount: 499, status: "active", next_renewal: "2026-04-20", mrr: 499, seats_used: 125, seats_limit: 200 },
    { subscription_id: "sub-3", company_id: "c3", company_name: "Global Services Ltd.", plan: "Enterprise", amount: 4999, status: "active", next_renewal: "2026-03-28", mrr: 4999, seats_used: 890, seats_limit: 1000 },
    { subscription_id: "sub-4", company_id: "c4", company_name: "Small Biz Co.", plan: "Starter", amount: 99, status: "expired", next_renewal: "2026-02-10", mrr: 0, seats_used: 12, seats_limit: 25 },
    { subscription_id: "sub-5", company_id: "c5", company_name: "Innovation Labs", plan: "Professional", amount: 499, status: "trial", next_renewal: "2026-03-22", mrr: 0, seats_used: 8, seats_limit: 200 },
  ];
}

// GET /admin/subscriptions/stats
export async function getBillingStats(): Promise<BillingStats> {
  return { total_mrr: 10497, active_subscriptions: 3, trial_accounts: 1, expiring_soon: 1 };
}

// GET /admin/subscriptions/plans
export async function getPlans(): Promise<PlanConfig[]> {
  return [
    { plan: "Starter",      price: 99,   seats: 25,   features: ["Core HR", "Employee Directory", "Basic Reporting"] },
    { plan: "Professional", price: 499,  seats: 200,  features: ["Everything in Starter", "Recruitment Module", "Performance Management", "API Access"] },
    { plan: "Enterprise",   price: 4999, seats: 1000, features: ["Everything in Professional", "Custom Integrations", "Dedicated Support", "SLA Guarantee", "Audit Logs"] },
  ];
}

// PATCH /admin/subscriptions/:id — body: { plan?, status? }
export async function updateSubscription(
  subscriptionId: string,
  payload: Partial<Pick<Subscription, "plan" | "status">>
): Promise<void> {
  // TODO: implement PATCH /admin/subscriptions/:id
  void subscriptionId; void payload;
}

// ─── HR Lifecycle RBAC ────────────────────────────────────────────────────────

export type PermissionKey = "read" | "create" | "update" | "delete";

export interface PermissionSet {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface LifecycleRolePermission {
  role_name: string;
  permissions: PermissionSet;
}

export interface LifecycleModule {
  module_id: string;
  name: string;
  description: string;
  icon: string; // used by frontend to pick icon — see settings/page.tsx MODULE_ICONS
  roles: LifecycleRolePermission[];
}

// GET /admin/hr-lifecycle/permissions
export async function getLifecyclePermissions(): Promise<LifecycleModule[]> {
  const res = await authFetch(`${API_BASE_URL}/users/hr-lifecycle/permissions`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to fetch lifecycle permissions");
  return data as LifecycleModule[];
}

// PUT /admin/hr-lifecycle/permissions — body: { module_id, roles }[]
export async function saveLifecyclePermissions(
  modules: Pick<LifecycleModule, "module_id" | "roles">[]
): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/users/hr-lifecycle/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(modules),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to save permissions");
}

// ─── Departments ──────────────────────────────────────────────────────────────

// GET /admin/departments
export async function getDepartments(): Promise<string[]> {
  return ["Human Resources", "Engineering", "Operations", "Finance", "Marketing", "Sales", "Legal"];
}
