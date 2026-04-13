-- Migration 007: Create recruitment_timeline table
-- Logs handoff events between Recruiter -> Interviewer -> HR Officer during the recruitment process.

CREATE TABLE IF NOT EXISTS recruitment_timeline (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  event_type VARCHAR(50) NOT NULL,
  -- e.g. 'application_submitted', 'shortlisted', 'on_hold', 'rejected',
  --      'first_interview_scheduled', 'first_interview_passed', 'first_interview_failed',
  --      'technical_interview_scheduled', 'technical_interview_passed', 'technical_interview_failed',
  --      'final_interview_scheduled', 'final_interview_passed', 'final_interview_failed',
  --      'offer_created', 'offer_sent', 'offer_accepted', 'offer_declined', 'hired',
  --      'handoff_to_interviewer', 'handoff_to_hr_officer'

  from_stage VARCHAR(50),
  to_stage VARCHAR(50),
  performed_by UUID,
  performed_by_role VARCHAR(50),
  notes TEXT,

  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_timeline_application
  ON recruitment_timeline(application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recruitment_timeline_company
  ON recruitment_timeline(company_id, created_at DESC);
