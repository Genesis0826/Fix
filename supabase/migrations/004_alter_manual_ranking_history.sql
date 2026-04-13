-- Migration 004: Add reason and triggered_by columns to manual_ranking_history
-- Track why a ranking change occurred (SFIA failure, manual override, etc.)

ALTER TABLE manual_ranking_history
  ADD COLUMN IF NOT EXISTS reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50);

-- Backfill existing records
UPDATE manual_ranking_history SET reason = 'manual_override' WHERE reason IS NULL;
