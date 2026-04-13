-- Migration 006: Add reason and triggered_by columns to manual_ranking_history
-- Order: Run SIXTH - enables ranking change audit trail

ALTER TABLE manual_ranking_history
ADD COLUMN IF NOT EXISTS reason VARCHAR(255),
ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50);

-- Backfill existing records
UPDATE manual_ranking_history
SET reason = 'manual_override'
WHERE reason IS NULL;

-- Rollback:
-- ALTER TABLE manual_ranking_history
--   DROP COLUMN IF EXISTS reason,
--   DROP COLUMN IF EXISTS triggered_by;
