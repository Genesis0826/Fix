-- Migration 009: Create job_offers table
-- Order: Run NINTH - offer management flow (draft → sent → accepted/declined)

CREATE TABLE IF NOT EXISTS job_offers (
  offer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  company_id UUID NOT NULL,

  status VARCHAR(30) DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'withdrawn')),

  -- Compensation details
  base_salary DECIMAL(12, 2),
  currency VARCHAR(10) DEFAULT 'PHP',
  pay_frequency VARCHAR(20) DEFAULT 'monthly'
    CHECK (pay_frequency IN ('hourly', 'daily', 'weekly', 'bi_weekly', 'monthly', 'annually')),
  start_date DATE,
  position_title VARCHAR(255),
  department VARCHAR(255),

  -- Benefits (free-form JSON for flexibility)
  benefits JSONB,

  -- Letter content
  offer_letter_notes TEXT,

  -- Tracking
  created_by UUID,
  sent_at TIMESTAMP,
  responded_at TIMESTAMP,
  applicant_response_note TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_application ON job_offers(application_id);
CREATE INDEX IF NOT EXISTS idx_offer_company ON job_offers(company_id, status);

-- Rollback:
-- DROP TABLE IF EXISTS job_offers CASCADE;
