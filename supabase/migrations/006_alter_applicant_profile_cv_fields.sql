-- Migration 006: Add CV parsing fields to applicant_profile
-- Track resume URL and Pillar parsing status per applicant.

ALTER TABLE applicant_profile
  ADD COLUMN IF NOT EXISTS resume_parsed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cv_parsing_status VARCHAR(20)
    CHECK (cv_parsing_status IN ('pending', 'processing', 'completed', 'failed'))
    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cv_parsing_error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_applicant_cv_pending
  ON applicant_profile(cv_parsing_status)
  WHERE cv_parsing_status = 'pending';
