-- Migration 002: Add ranking_source column to job_application_sfia
-- Tracks whether a candidate was ranked via SFIA auto-ranking or a fallback.

ALTER TABLE job_application_sfia
ADD COLUMN IF NOT EXISTS ranking_source VARCHAR(50) DEFAULT 'sfia_auto'
  CONSTRAINT chk_ranking_source CHECK (
    ranking_source IN ('sfia_auto', 'manual_fallback', 'manual_override')
  );

-- Backfill existing rows based on current ranking_mode value
UPDATE job_application_sfia
SET ranking_source = 'sfia_auto'
WHERE ranking_mode = 'sfia'
  AND ranking_source IS NULL;

UPDATE job_application_sfia
SET ranking_source = 'manual_override'
WHERE ranking_mode = 'manual'
  AND ranking_source IS NULL;

-- Default any remaining NULL rows to sfia_auto
UPDATE job_application_sfia
SET ranking_source = 'sfia_auto'
WHERE ranking_source IS NULL;
