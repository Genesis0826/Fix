-- Migration 005: Alter job_application_sfia — add ranking_source column
-- Tracks whether the candidate's rank was determined by SFIA auto-ranking,
-- a manual fallback (SFIA unavailable), or a deliberate manual override.

ALTER TABLE job_application_sfia
  ADD COLUMN IF NOT EXISTS ranking_source TEXT DEFAULT 'sfia_auto'
    CHECK (ranking_source IN ('sfia_auto', 'manual_fallback', 'manual_override'));

-- Back-fill existing rows based on their current ranking_mode
UPDATE job_application_sfia
SET ranking_source = 'sfia_auto'
WHERE ranking_source IS NULL AND ranking_mode IN ('SFIA', 'sfia');

UPDATE job_application_sfia
SET ranking_source = 'manual_override'
WHERE ranking_source IS NULL AND ranking_mode IN ('MANUAL', 'manual');

-- Catch-all: any remaining rows default to sfia_auto
UPDATE job_application_sfia
SET ranking_source = 'sfia_auto'
WHERE ranking_source IS NULL;
