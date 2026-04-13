-- Migration 006: Add reason and triggered_by columns to manual_ranking_history
-- NOTE: The requirements document contained a typo "triggerred_by" – the correct
-- column name used throughout the codebase is "triggered_by" (single 'r').

ALTER TABLE manual_ranking_history
ADD COLUMN IF NOT EXISTS reason VARCHAR(255),       -- e.g. 'pillar_failure', 'operator_override', 'sfia_disabled'
ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50);  -- 'recruiter', 'system', 'admin', etc.

-- Backfill existing records with the default reason
UPDATE manual_ranking_history
SET reason = 'manual_override'
WHERE reason IS NULL;
