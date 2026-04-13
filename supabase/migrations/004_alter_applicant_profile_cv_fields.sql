-- Migration 004: Add CV parsing columns to applicant_profile
-- Supports Pillar CV parsing workflow: status tracking and resume URL storage.

ALTER TABLE applicant_profile
ADD COLUMN IF NOT EXISTS resume_parsed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cv_parsing_status VARCHAR(20) DEFAULT 'pending'
  CONSTRAINT chk_cv_parsing_status CHECK (
    cv_parsing_status IN ('pending', 'completed', 'failed')
  ),
ADD COLUMN IF NOT EXISTS cv_parsing_error_message TEXT;

-- Index to quickly find applicants whose CVs still need parsing
CREATE INDEX IF NOT EXISTS idx_applicant_cv_pending
  ON applicant_profile(cv_parsing_status)
  WHERE cv_parsing_status = 'pending';
