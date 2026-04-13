-- Migration 004: Alter manual_ranking_history — add reason & triggered_by columns
-- These columns record WHY a manual ranking change happened and what event
-- triggered it (e.g. pillar_failure, operator_override, sfia_disabled).
-- NOTE: The column is named `triggered_by` (NOT `triggerred_by` — that was a
--       typo in the original DATABASE_MIGRATIONS.md spec; corrected here).

ALTER TABLE manual_ranking_history
  ADD COLUMN IF NOT EXISTS reason VARCHAR(255),      -- 'pillar_failure' | 'operator_override' | 'sfia_disabled'
  ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50); -- 'system' | 'hr_recruiter' | user_id

-- Back-fill existing rows so reason is never NULL for old records
UPDATE manual_ranking_history
SET reason = 'manual_override'
WHERE reason IS NULL;
