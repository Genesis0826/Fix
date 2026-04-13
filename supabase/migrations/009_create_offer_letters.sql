-- Migration 009: Create offer_letters table
-- Persists offer drafts, approved offers, and their compensation/benefits details.
-- Supports the offer draft → review → send email flow.

CREATE TABLE IF NOT EXISTS offer_letters (
  offer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(job_posting_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profile(applicant_id) ON DELETE CASCADE,

  status VARCHAR(30) DEFAULT 'draft'
    CONSTRAINT chk_offer_status CHECK (
      status IN ('draft', 'pending_approval', 'approved', 'sent', 'accepted', 'declined', 'expired', 'revoked')
    ),

  -- Compensation & Benefits
  job_title VARCHAR(255),
  department VARCHAR(255),
  start_date DATE,
  base_salary DECIMAL(14, 2),
  salary_currency VARCHAR(10) DEFAULT 'USD',
  pay_frequency VARCHAR(20) DEFAULT 'monthly'
    CONSTRAINT chk_pay_frequency CHECK (
      pay_frequency IN ('hourly', 'weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'annual')
    ),
  bonus DECIMAL(14, 2),
  benefits JSONB,                               -- flexible list: health, dental, PTO, etc.
  additional_terms TEXT,

  -- Offer letter body / template
  offer_body TEXT,

  -- Workflow tracking
  drafted_by UUID,
  approved_by UUID,
  sent_at TIMESTAMP,
  expires_at TIMESTAMP,
  responded_at TIMESTAMP,
  applicant_response VARCHAR(20)
    CONSTRAINT chk_applicant_response CHECK (
      applicant_response IN ('accepted', 'declined', NULL)
    ),
  applicant_response_notes TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_application ON offer_letters(application_id);
CREATE INDEX IF NOT EXISTS idx_offer_company ON offer_letters(company_id, created_at DESC);
