// src/lib/authApi.ts
import { API_BASE_URL } from "./api";
import {
  clearAuthStorage,
  getAccessToken,
  writeAccessToken,
  getUserInfo,
} from "./authStorage";

let refreshPromise: Promise<any> | null = null;

export async function loginApi(body: {
  identifier: string;
  password: string;
  rememberMe: boolean;
}) {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // receive the HttpOnly refresh_token cookie
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data?.message || "Login failed");

  return data as { access_token: string };
}

export async function applicantRegisterApi(
  body: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    phone_number?: string;
  },
  companyId?: string,
) {
  const url = companyId
    ? `${API_BASE_URL}/applicants/register?company=${encodeURIComponent(companyId)}`
    : `${API_BASE_URL}/applicants/register`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Registration failed");

  return data as { applicant_id: string; email: string; message: string };
}

export async function applicantLoginApi(body: { email: string; password: string; rememberMe?: boolean }) {
  const res = await fetch(`${API_BASE_URL}/applicants/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Login failed");

  return data as { access_token: string };
}


export async function googleLoginApi(googleToken: string) {
  const res = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token: googleToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Google login failed");
  return data as { access_token: string };
}

export async function refreshApi() {
  const res = await fetch(`${API_BASE_URL}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // sends the HttpOnly refresh_token cookie automatically
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Refresh failed");

  if (!data?.access_token) throw new Error("Missing access_token");
  writeAccessToken(data.access_token);

  return data as { access_token: string };
}

export async function applicantRefreshApi() {
  const res = await fetch(`${API_BASE_URL}/applicants/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Applicant refresh failed");
  if (!data?.access_token) throw new Error("Missing access_token");
  writeAccessToken(data.access_token);
  return data as { access_token: string };
}

export async function applicantResendVerificationApi(email: string) {
  const res = await fetch(`${API_BASE_URL}/applicants/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to resend verification email");
  return data as { message: string };
}

export async function applicantLogoutApi() {
  const access_token = getAccessToken();
  await fetch(`${API_BASE_URL}/applicants/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
    },
    credentials: "include",
  }).catch(() => {});
  clearAuthStorage();
}

export async function logoutApi() {
  const access_token = getAccessToken();

  await fetch(`${API_BASE_URL}/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
    },
    credentials: "include", // sends the HttpOnly refresh_token cookie for server to blacklist
  }).catch(() => {});

  clearAuthStorage();
}

// ---------------------------------------------------------------------------
// Job-related API helpers (applicant-facing)
// ---------------------------------------------------------------------------

export async function getApplicantJobs() {
  const res = await authFetch(`${API_BASE_URL}/jobs/applicant/open`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to fetch jobs");
  return data as JobPosting[];
}

export async function getJobQuestions(jobPostingId: string): Promise<ApplicationQuestion[]> {
  const res = await fetch(`${API_BASE_URL}/jobs/${jobPostingId}/questions`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to fetch questions");
  return data as ApplicationQuestion[];
}

export async function applyToJob(
  jobPostingId: string,
  dto?: { answers?: { question_id: string; answer_value?: string }[] },
) {
  const res = await authFetch(`${API_BASE_URL}/jobs/${jobPostingId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to apply");
  return data;
}

// ─── Interview Schedule (Email + Notification trigger) ───────────────────────

export interface InterviewSchedulePayload {
  application_id:     string;
  scheduled_date:     string;         // "YYYY-MM-DD"
  scheduled_time:     string;         // "HH:MM"
  duration_minutes:   number;
  format:             string;         // "in_person" | "video" | "phone"
  location?:          string | null;
  meeting_link?:      string | null;
  interviewer_name:   string;
  interviewer_title?: string | null;
  notes?:             string | null;
  stage?:             string | null;  // "first_interview" | "technical_interview" | "final_interview"
  scheduled_by_email?: string | null;
}

/**
 * Sends the interview schedule to the applicant via email and stores
 * the schedule on the backend. Called by HR after confirming a schedule.
 */
export async function sendInterviewSchedule(
  payload: InterviewSchedulePayload,
): Promise<void> {
  const res = await authFetch(
    `${API_BASE_URL}/jobs/applications/${payload.application_id}/interview-schedule`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    },
  );
  // If the endpoint doesn't exist yet, we swallow the error gracefully
  // so the UI flow isn't blocked.
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || "Failed to send interview schedule");
  }
}

export type HRInterviewNotification = {
  schedule_id:             string;
  application_id:          string;
  scheduled_date:          string;
  scheduled_time:          string;
  format:                  string;
  interviewer_name:        string;
  applicant_response:      "accepted" | "declined" | "reschedule_requested";
  applicant_response_note: string | null;
  applicant_responded_at:  string | null;
  job_title:               string;
  first_name:              string;
  last_name:               string;
  email:                   string;
};

export async function getHRInterviewNotifications(): Promise<HRInterviewNotification[]> {
  const res = await authFetch(`${API_BASE_URL}/jobs/hr/interview-notifications`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to fetch notifications");
  return data as HRInterviewNotification[];
}

export async function cancelInterviewSchedule(
  applicationId: string,
  stage: string,
  reason?: string,
): Promise<void> {
  const params = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  const res = await authFetch(
    `${API_BASE_URL}/jobs/applications/${applicationId}/interview-schedule/${stage}${params}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || "Failed to cancel interview schedule");
  }
}

export async function resendInterviewEmail(applicationId: string): Promise<void> {
  const res = await authFetch(
    `${API_BASE_URL}/jobs/applications/${applicationId}/interview-schedule/resend`,
    { method: "POST" },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || "Failed to resend interview email");
  }
}

export async function getApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  const res = await authFetch(`${API_BASE_URL}/jobs/applications/${applicationId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to fetch application detail");
  return data as ApplicationDetail;
}

export async function getMyApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  const res = await authFetch(`${API_BASE_URL}/jobs/applicant/my-applications/${applicationId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to fetch application detail");
  return data as ApplicationDetail;
}

export async function getMyApplications() {
  const res = await authFetch(`${API_BASE_URL}/jobs/applicant/my-applications`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to fetch applications");
  return data as MyApplication[];
}

export type JobPosting = {
  job_posting_id: string;
  title: string;
  description: string;
  location: string | null;
  employment_type: string | null;
  salary_range: string | null;
  status: "open" | "closed" | "draft";
  posted_at: string;
  closes_at: string | null;
  department_id: string | null;
  company_id: string;
};

export type MyApplication = {
  application_id: string;
  status: string;
  applied_at: string;
  job_posting_id: string;
  job_postings: {
    title: string;
    location: string | null;
    employment_type: string | null;
    status: string;
  };
};

export type ApplicationQuestion = {
  question_id: string;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox";
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
};

export type InterviewSchedule = {
  schedule_id?:            string;
  application_id:          string;
  stage?:                  string | null;   // "first_interview" | "technical_interview" | "final_interview"
  scheduled_date:          string;          // "YYYY-MM-DD"
  scheduled_time:          string;          // "HH:MM"
  duration_minutes:        number;
  format:                  string;          // "in_person" | "video" | "phone"
  location:                string | null;
  meeting_link:            string | null;
  interviewer_name:        string;
  interviewer_title:       string | null;
  notes:                   string | null;
  created_at?:             string;
  updated_at?:             string;
  applicant_response?:     'accepted' | 'declined' | 'reschedule_requested' | null;
  applicant_response_note?: string | null;
  applicant_responded_at?: string | null;
};

export type MyInterviewSchedule = InterviewSchedule & {
  job_title:          string;
  application_status: string;
};

export type InterviewAction = 'accepted' | 'declined' | 'reschedule_requested';

export async function respondToInterview(
  applicationId: string,
  action: InterviewAction,
  note: string,
  stage?: string,
): Promise<void> {
  const res = await authFetch(
    `${API_BASE_URL}/jobs/applicant/my-applications/${applicationId}/interview-response`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note, ...(stage ? { stage } : {}) }),
    },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || "Failed to submit response");
  }
}

export async function getMyInterviewSchedules(): Promise<MyInterviewSchedule[]> {
  const res = await authFetch(`${API_BASE_URL}/jobs/applicant/my-interview-schedules`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed to fetch interview schedules");
  return data as MyInterviewSchedule[];
}

export type ApplicationDetail = {
  application_id: string;
  status: string;
  applied_at: string;
  job_posting_id: string;
  applicant_profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
    applicant_code: string;
    resume_url: string | null;
    resume_name: string | null;
    resume_uploaded_at: string | null;
  };
  answers: {
    answer_id: string;
    answer_value: string | null;
    application_questions: {
      question_id: string;
      question_text: string;
      question_type: string;
      options: string[] | null;
      sort_order: number;
    };
  }[];
  // Latest schedule (backwards compat)
  interview_schedule?: InterviewSchedule | null;
  // Per-stage schedules map: stage → schedule
  interview_schedules?: Record<string, InterviewSchedule>;
};

// ---------------------------------------------------------------------------
// Public careers page API helpers (no auth required)
// ---------------------------------------------------------------------------

export type PublicCareersPage = {
  company_id: string;
  company_name: string;
  slug: string;
  jobs: Pick<JobPosting, 'job_posting_id' | 'title' | 'description' | 'location' | 'employment_type' | 'salary_range' | 'posted_at' | 'closes_at'>[];
};

export async function getPublicCareers(slug: string): Promise<PublicCareersPage> {
  const res = await fetch(`${API_BASE_URL}/jobs/public/careers/${encodeURIComponent(slug)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Company not found');
  return data as PublicCareersPage;
}

// ---------------------------------------------------------------------------
// Onboarding API helpers (applicant-facing)
// ---------------------------------------------------------------------------

export type OnboardingSubmission = {
  submission_id: string;
  applicant_id: string;
  application_id: string;
  job_posting_id: string;
  company_id: string;
  status: 'pending' | 'draft' | 'submitted' | 'approved' | 'rejected';
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  civil_status: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  preferred_username: string | null;
  department_id: string | null;
  start_date: string | null;
  hr_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  job_postings?: { title: string } | null;
};

export type HROnboardingSubmission = OnboardingSubmission & {
  applicant_profile: { first_name: string; last_name: string; email: string; phone_number: string | null };
  job_postings: { title: string } | null;
};

// ---------------------------------------------------------------------------
// Profile API helpers
// ---------------------------------------------------------------------------

export type ApplicantProfile = {
  applicant_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  phone_number: string | null;
  personal_email: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  nationality: string | null;
  civil_status: string | null;
  complete_address: string | null;
  applicant_code: string | null;
  avatar_url: string | null;
  resume_url: string | null;
  resume_name: string | null;
  resume_uploaded_at: string | null;
};

export type EmployeeProfile = {
  user_id: string;
  employee_id: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  username: string | null;
  department_id: string | null;
  start_date: string | null;
  personal_email: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  nationality: string | null;
  civil_status: string | null;
  complete_address: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  avatar_url: string | null;
};

export async function getApplicantProfile(): Promise<ApplicantProfile> {
  const res = await authFetch(`${API_BASE_URL}/applicants/me`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to fetch profile');
  return data as ApplicantProfile;
}

export async function uploadApplicantResume(file: File): Promise<{ resume_url: string; resume_name: string; resume_uploaded_at: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch(`${API_BASE_URL}/applicants/me/resume`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Upload failed');
  return data as { resume_url: string; resume_name: string; resume_uploaded_at: string };
}

export async function deleteApplicantResume(): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/applicants/me/resume`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || 'Delete failed');
  }
}

export async function updateApplicantProfile(body: Partial<Omit<ApplicantProfile, 'applicant_id' | 'email' | 'applicant_code'>>): Promise<ApplicantProfile> {
  const res = await authFetch(`${API_BASE_URL}/applicants/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to update profile');
  return data as ApplicantProfile;
}

export async function getEmployeeProfile(): Promise<EmployeeProfile> {
  const res = await authFetch(`${API_BASE_URL}/users/me`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to fetch profile');
  return data as EmployeeProfile;
}

export async function updateEmployeeProfile(body: Partial<Omit<EmployeeProfile, 'user_id' | 'employee_id' | 'email' | 'username' | 'first_name' | 'last_name' | 'department_id' | 'start_date'>>): Promise<EmployeeProfile> {
  const res = await authFetch(`${API_BASE_URL}/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to update profile');
  return data as EmployeeProfile;
}

export async function getMyOnboarding(): Promise<OnboardingSubmission | null> {
  const res = await authFetch(`${API_BASE_URL}/onboarding/my-onboarding`);
  if (res.status === 404) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to fetch onboarding');
  return (data as OnboardingSubmission | null) ?? null;
}

export async function saveOnboarding(
  body: Partial<Omit<OnboardingSubmission, 'submission_id' | 'applicant_id' | 'application_id' | 'job_posting_id' | 'company_id' | 'status' | 'hr_notes' | 'submitted_at' | 'reviewed_at' | 'created_at' | 'updated_at'>>,
): Promise<OnboardingSubmission> {
  const res = await authFetch(`${API_BASE_URL}/onboarding/my-onboarding`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to save onboarding');
  return data as OnboardingSubmission;
}

export async function submitOnboarding(): Promise<OnboardingSubmission> {
  const res = await authFetch(`${API_BASE_URL}/onboarding/my-onboarding/submit`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to submit onboarding');
  return data as OnboardingSubmission;
}

// ---------------------------------------------------------------------------
// Onboarding API helpers (HR-facing)
// ---------------------------------------------------------------------------

export async function getHROnboardingSubmissions(status?: string): Promise<HROnboardingSubmission[]> {
  const url = status
    ? `${API_BASE_URL}/onboarding/submissions?status=${encodeURIComponent(status)}`
    : `${API_BASE_URL}/onboarding/submissions`;
  const res = await authFetch(url);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to fetch submissions');
  return data as HROnboardingSubmission[];
}

export async function getHROnboardingSubmission(submissionId: string): Promise<HROnboardingSubmission> {
  const res = await authFetch(`${API_BASE_URL}/onboarding/submissions/${submissionId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to fetch submission');
  return data as HROnboardingSubmission;
}

export async function approveOnboardingSubmission(
  submissionId: string,
  roleId: string,
): Promise<{ user_id: string; employee_id: string; email: string; invite_expires_at: string }> {
  const res = await authFetch(`${API_BASE_URL}/onboarding/submissions/${submissionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_id: roleId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string })?.message || 'Failed to approve onboarding');
  return data as { user_id: string; employee_id: string; email: string; invite_expires_at: string };
}

export async function rejectOnboardingSubmission(submissionId: string, hrNotes: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/onboarding/submissions/${submissionId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hr_notes: hrNotes }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || 'Failed to reject onboarding');
  }
}

export async function getMyCompany(): Promise<{ company_id: string; company_name: string; slug: string }> {
  const res = await authFetch(`${API_BASE_URL}/users/company/me`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Failed to fetch company info');
  return data;
}

// ---------------------------------------------------------------------------
// Employee Documents API
// ---------------------------------------------------------------------------

export type EmployeeDocument = {
  id: string;
  user_id: string;
  document_type: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  status: 'pending' | 'approved' | 'rejected';
  hr_notes: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  file_url: string | null;
};

export async function getMyEmployeeDocuments(): Promise<EmployeeDocument[]> {
  const res = await authFetch(`${API_BASE_URL}/users/me/documents`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || 'Failed to fetch documents');
  return data as EmployeeDocument[];
}

export async function uploadMyDocument(docType: string, file: File): Promise<EmployeeDocument> {
  const formData = new FormData();
  formData.append('document_type', docType);
  formData.append('file', file);
  const res = await authFetch(`${API_BASE_URL}/users/me/documents`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || 'Upload failed');
  return data as EmployeeDocument;
}

export async function deleteMyDocument(docId: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/users/me/documents/${docId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.message || 'Delete failed');
  }
}

export async function getPendingEmployeeDocuments(): Promise<(EmployeeDocument & { user_profile: { first_name: string; last_name: string; employee_id: string } })[]> {
  const res = await authFetch(`${API_BASE_URL}/users/documents/pending`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || 'Failed to fetch pending documents');
  return data as any[];
}

export async function approveEmployeeDocument(docId: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/users/documents/${docId}/approve`, { method: 'PATCH' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.message || 'Approve failed');
  }
}

export async function rejectEmployeeDocument(docId: string, hrNotes: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/users/documents/${docId}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hr_notes: hrNotes }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.message || 'Reject failed');
  }
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const access = getAccessToken();

  // 1) try request with access token
  // credentials: "include" ensures the HttpOnly refresh cookie is forwarded
  const first = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...init.headers,
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
  });

  // if not unauthorized, return
  if (first.status !== 401) return first;

  // 2) try refresh then retry (shared promise prevents concurrent refresh race)
  try {
    if (!refreshPromise) {
      const userInfo = getUserInfo();
      const doRefresh = userInfo?.role === "applicant" ? applicantRefreshApi : refreshApi;
      refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
    }
    const { access_token } = await refreshPromise;

    const second = await fetch(input, {
      ...init,
      credentials: "include",
      headers: {
        ...init.headers,
        Authorization: `Bearer ${access_token}`,
      },
    });

    return second;
  } catch {
    // Save role BEFORE clearing storage — getUserInfo() returns null after clear
    const roleBeforeClear = getUserInfo()?.role;
    clearAuthStorage();
    if (globalThis.window !== undefined) {
      globalThis.location.href = roleBeforeClear === "applicant" ? "/applicant/login" : "/login";
    }
    return first;
  }
}
