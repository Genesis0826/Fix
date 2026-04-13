-- Migration 009: Create offer_letters table
-- Tracks formal job offers including compensation/benefits details and acceptance status.

CREATE TABLE IF NOT EXISTS offer_letters (
  offer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profile(applicant_id) ON DELETE CASCADE,

  -- Offer details
  job_title VARCHAR(255) NOT NULL,
  department VARCHAR(255),
  start_date DATE,
  employment_type VARCHAR(50),

  -- Compensation & Benefits
  base_salary DECIMAL(12, 2),
  salary_currency VARCHAR(10) DEFAULT 'PHP',
  salary_frequency VARCHAR(20) DEFAULT 'monthly',
  -- e.g. 'monthly', 'annual', 'bi-weekly'
  benefits JSONB,
  -- e.g. {"health_insurance": true, "dental": true, "sss": true, "philhealth": true, "pagibig": true, "13th_month": true}
  allowances JSONB,
  -- e.g. {"transportation": 3000, "meal": 2000, "clothing": 1000}
  signing_bonus DECIMAL(12, 2),
  notes TEXT,

  -- Offer lifecycle
  status VARCHAR(20)
    CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'withdrawn'))
    DEFAULT 'draft',
  sent_at TIMESTAMP,
  responded_at TIMESTAMP,
  expires_at TIMESTAMP,

  -- Audit fields
  created_by UUID REFERENCES user_profile(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_letters_application ON offer_letters(application_id);
CREATE INDEX IF NOT EXISTS idx_offer_letters_company ON offer_letters(company_id, status);
CREATE INDEX IF NOT EXISTS idx_offer_letters_applicant ON offer_letters(applicant_id);
