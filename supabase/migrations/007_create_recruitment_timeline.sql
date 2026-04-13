-- Migration 007: Create recruitment_timeline table
-- Logs Recruiter → Interviewer → HR Officer hand-off transitions and other
-- first-class pipeline events for full audit/reporting visibility.

CREATE TABLE IF NOT EXISTS recruitment_timeline (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(job_posting_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  -- Who performed the transition and what role they hold
  performed_by UUID,                            -- user_id of the actor (NULL if system-triggered)
  actor_role VARCHAR(100),                      -- e.g. 'Recruiter', 'Interviewer', 'HR Officer', 'System'

  -- Event classification
  event_type VARCHAR(100) NOT NULL,             -- e.g. 'application_received', 'shortlisted',
                                                --      'interview_scheduled', 'offer_sent',
                                                --      'recruiter_to_interviewer', 'interviewer_to_hr'
  from_status VARCHAR(100),                     -- previous application status / stage
  to_status VARCHAR(100),                       -- new application status / stage
  notes TEXT,                                   -- free-text annotation

  event_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rt_application ON recruitment_timeline(application_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_rt_company ON recruitment_timeline(company_id, event_at DESC);
