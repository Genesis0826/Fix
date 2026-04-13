-- Migration 009: Create job_offers table
-- Supports the offer management flow: HR drafts an offer, records compensation
-- and benefits details, and sends an offer email to the candidate.

CREATE TABLE IF NOT EXISTS job_offers (
  offer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(job_posting_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profile(applicant_id) ON DELETE CASCADE,

  -- Offer lifecycle
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'withdrawn')),

  -- Compensation details
  position_title TEXT,
  department TEXT,
  start_date DATE,
  base_salary DECIMAL(12, 2),
  currency VARCHAR(10) DEFAULT 'PHP',
  salary_frequency TEXT DEFAULT 'monthly'
    CHECK (salary_frequency IN ('hourly', 'daily', 'weekly', 'bi_weekly', 'monthly', 'annually')),

  -- Benefits (free-text or JSONB list)
  benefits_summary TEXT,
  benefits_detail JSONB,

  -- Offer letter content
  offer_letter_text TEXT,               -- Full HTML/plain text of the offer letter

  -- Who created / sent it
  created_by UUID,                      -- user_id of HR actor
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID,

  -- Candidate response
  responded_at TIMESTAMP WITH TIME ZONE,
  response_notes TEXT,

  -- Expiry
  expires_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offers_application
  ON job_offers(application_id);

CREATE INDEX IF NOT EXISTS idx_offers_company
  ON job_offers(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offers_applicant
  ON job_offers(applicant_id);
