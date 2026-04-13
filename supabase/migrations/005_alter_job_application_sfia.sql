-- Migration 005: Add ranking_source column to job_application_sfia
-- Track whether a candidate was ranked via SFIA auto-ranking or manual fallback.

ALTER TABLE job_application_sfia
  ADD COLUMN IF NOT EXISTS ranking_source VARCHAR(20)
    CHECK (ranking_source IN ('sfia_auto', 'manual_fallback', 'manual_override'))
    DEFAULT 'sfia_auto';

-- Backfill existing records based on ranking_mode
UPDATE job_application_sfia SET ranking_source = 'sfia_auto'       WHERE ranking_mode ILIKE 'sfia'   AND ranking_source IS NULL;
UPDATE job_application_sfia SET ranking_source = 'manual_override'  WHERE ranking_mode ILIKE 'manual' AND ranking_source IS NULL;
