-- Migration 004: Add CV parsing fields to applicant_profile
-- Order: Run FOURTH - enables CV parsing status tracking

ALTER TABLE applicant_profile
ADD COLUMN IF NOT EXISTS resume_parsed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cv_parsing_status VARCHAR(20) DEFAULT 'pending'
  CHECK (cv_parsing_status IN ('pending', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS cv_parsing_error_message TEXT;

-- Create index for batch CV parsing jobs (find all pending)
CREATE INDEX IF NOT EXISTS idx_applicant_cv_pending
  ON applicant_profile(cv_parsing_status)
  WHERE cv_parsing_status = 'pending';

-- Note: resume_url already exists in applicant_profile based on code inspection.
-- If it does not exist in your schema yet, uncomment the line below:
-- ALTER TABLE applicant_profile ADD COLUMN IF NOT EXISTS resume_url VARCHAR(500);

-- Rollback:
-- ALTER TABLE applicant_profile
--   DROP COLUMN IF EXISTS resume_parsed_at,
--   DROP COLUMN IF EXISTS cv_parsing_status,
--   DROP COLUMN IF EXISTS cv_parsing_error_message;
-- DROP INDEX IF EXISTS idx_applicant_cv_pending;
