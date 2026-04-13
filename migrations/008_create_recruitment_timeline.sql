-- Migration 008: Create recruitment_timeline table
-- Order: Run EIGHTH - tracks handoff events (Recruiter → Interviewer → HR Officer)

CREATE TABLE IF NOT EXISTS recruitment_timeline (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  company_id UUID NOT NULL,

  event_type VARCHAR(50) NOT NULL,
    -- Examples: 'application_submitted', 'shortlisted', 'on_hold', 'interview_scheduled',
    --           'interview_completed', 'passed_to_interviewer', 'passed_to_hr_officer',
    --           'offer_sent', 'offer_accepted', 'hired', 'rejected'

  from_stage VARCHAR(50),
  to_stage VARCHAR(50),

  performed_by UUID,
  performed_by_name VARCHAR(255),
  performed_by_role VARCHAR(50),

  notes TEXT,
  metadata JSONB,

  occurred_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_application ON recruitment_timeline(application_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_company ON recruitment_timeline(company_id, occurred_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS recruitment_timeline CASCADE;
