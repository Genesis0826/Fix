// Shared types aligned to Supabase schema

export type OnboardingStatus = 'not-started' | 'in-progress' | 'for-review' | 'approved' | 'overdue';
export type ItemStatus = 'pending' | 'submitted' | 'for-review' | 'approved' | 'rejected' | 'issued' | 'confirmed';

export interface Remark {
  remark_id: string;
  tab_tag: 'Documents' | 'Tasks' | 'Equipment' | 'Profile' | 'Forms';
  remark_text: string;
  created_at: string;
  author: string;
}

export interface DocumentSubmission {
  submission_id: string;
  onboarding_item_id: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  file_type: string;
  is_proof_of_receipt: boolean;
  status: 'uploaded' | 'approved' | 'rejected';
  uploaded_at: string;
}

export interface OnboardingItemBase {
  onboarding_item_id: string;
  title: string;
  status: ItemStatus;
  is_required: boolean;
  type: string;
  description?: string;
  rich_content?: string;
}

export interface DocumentItem extends OnboardingItemBase {
  files: DocumentSubmission[];
  upload_history: DocumentSubmission[];
}

export interface TaskItem extends OnboardingItemBase {}

export interface EquipmentItem extends OnboardingItemBase {
  is_requested?: boolean;
  delivery_method?: 'office' | 'delivery';
  delivery_address?: string;
  proof_of_receipt: DocumentSubmission[];
}

export interface HRFormItem extends OnboardingItemBase {}

export interface EmergencyContact {
  contact_name: string;
  relationship: string;
  emergency_phone_number: string;
  emergency_email_address?: string;
}

export interface ProfileData {
  profile_id?: string;
  session_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email_address: string;
  phone_number: string;
  complete_address: string;
  date_of_birth: string;
  place_of_birth: string;
  nationality: string;
  civil_status: string;
  emergency_contacts?: EmergencyContact[];
  // Legacy flat fields (kept for backward compat reads)
  contact_name?: string;
  relationship?: string;
  emergency_phone_number?: string;
  emergency_email_address?: string;
  status: string;
}

export interface OnboardingSession {
  session_id: string;
  account_id: string;
  template_id: string;
  template_name: string | null;
  employee_name: string | null;
  employee_id: string | null;
  assigned_position: string;
  assigned_department: string;
  status: OnboardingStatus;
  progress_percentage: number;
  deadline_date: string;
  completed_at: string | null;
  documents: DocumentItem[];
  tasks: TaskItem[];
  equipment: EquipmentItem[];
  hr_forms: HRFormItem[];
  profile_items: OnboardingItemBase[];
  welcome: OnboardingItemBase[];
  profile: ProfileData | null;
  remarks: Remark[];
}

export interface OnboardingSessionSummary {
  session_id: string;
  account_id: string;
  template_id: string;
  template_name: string | null;
  employee_name: string | null;
  assigned_position: string;
  assigned_department: string;
  status: OnboardingStatus;
  progress_percentage: number;
  deadline_date: string;
  completed_at: string | null;
}

export interface TemplateItem {
  item_id: string;
  type: string;
  tab_category: string;
  title: string;
  description?: string;
  is_required: boolean;
}

export interface OnboardingTemplate {
  template_id: string;
  name: string;
  department_id: string;
  position_id: string;
  default_deadline_days: number;
  created_at: string;
  template_items: TemplateItem[];
  position_name?: string | null;
  department_name?: string | null;
}

export interface JobPosition {
  position_id: string;
  department_id: string;
  position_name: string;
  department_name?: string | null;
  created_at: string;
}

export interface Department {
  department_id: string;
  department_name: string;
  company_id: string;
}
