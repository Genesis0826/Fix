-- Migration 002: Add ranking_source column to job_application_sfia
-- Order: Run SECOND - depends on job_application_sfia existing

ALTER TABLE job_application_sfia
ADD COLUMN IF NOT EXISTS ranking_source VARCHAR(50) DEFAULT 'sfia_auto'
  CHECK (ranking_source IN ('sfia_auto', 'manual_fallback', 'manual_override'));

-- Backfill existing rows based on ranking_mode
UPDATE job_application_sfia
SET ranking_source = 'sfia_auto'
WHERE ranking_mode ILIKE 'sfia' AND ranking_source IS NULL;

UPDATE job_application_sfia
SET ranking_source = 'manual_override'
WHERE ranking_mode ILIKE 'manual' AND ranking_source IS NULL;

-- Fallback for any remaining nulls
UPDATE job_application_sfia
SET ranking_source = 'sfia_auto'
WHERE ranking_source IS NULL;

-- Rollback:
-- ALTER TABLE job_application_sfia DROP COLUMN IF EXISTS ranking_source;
