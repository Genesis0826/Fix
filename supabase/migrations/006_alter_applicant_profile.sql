-- Migration 006: Alter applicant_profile — add CV / resume parsing fields
-- These columns support the Pillar CV-parsing integration:
--   resume_parsed_at   — timestamp of the last successful Pillar parse
--   cv_parsing_status  — lifecycle state of the parsing job
--   cv_parsing_error_message — last error message if parsing failed

ALTER TABLE applicant_profile
  ADD COLUMN IF NOT EXISTS resume_parsed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cv_parsing_status TEXT DEFAULT 'pending'
    CHECK (cv_parsing_status IN ('pending', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS cv_parsing_error_message TEXT;

-- Index for batch CV-parsing jobs that need to find all pending profiles
CREATE INDEX IF NOT EXISTS idx_applicant_cv_pending
  ON applicant_profile(cv_parsing_status)
  WHERE cv_parsing_status = 'pending';
