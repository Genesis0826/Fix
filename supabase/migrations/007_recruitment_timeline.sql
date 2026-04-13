-- Migration 007: Create recruitment_timeline_events table
-- First-class audit log for role-handoff transitions in the recruitment
-- pipeline: Recruiter → Interviewer → HR Officer and any other stage changes.
-- Complements the existing audit_logs table by providing a structured,
-- recruitment-specific event feed.

CREATE TABLE IF NOT EXISTS recruitment_timeline_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(job_posting_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  -- Who performed the action and what role they held at the time
  performed_by UUID,                   -- user_id of the HR/system actor (NULL = system)
  performer_role TEXT,                 -- e.g. 'HR Recruiter', 'HR Interviewer', 'HR Officer'

  -- What happened
  event_type TEXT NOT NULL,            -- 'status_change' | 'stage_handoff' | 'interview_scheduled' | 'offer_sent' | 'hired' | 'rejected'
  from_status TEXT,                    -- previous application status / stage
  to_status TEXT NOT NULL,             -- new application status / stage
  notes TEXT,                          -- optional free-text note

  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timeline_application
  ON recruitment_timeline_events(application_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_timeline_company
  ON recruitment_timeline_events(company_id, occurred_at DESC);
