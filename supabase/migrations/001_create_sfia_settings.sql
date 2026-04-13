-- Migration 001: Create sfia_settings table
-- Stores SFIA ranking configuration per company with audit trail.

CREATE TABLE IF NOT EXISTS sfia_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  -- Feature toggles
  sfia_enabled BOOLEAN DEFAULT true,

  -- Scoring configuration
  exact_match_points DECIMAL(4, 2) DEFAULT 3.00,
  above_demand_points DECIMAL(4, 2) DEFAULT 1.50,

  -- Failover configuration
  failover_threshold_percentage INTEGER DEFAULT 50,
  max_consecutive_failures INTEGER DEFAULT 2,
  consecutive_failures INTEGER DEFAULT 0,
  healthcheck_interval_seconds INTEGER DEFAULT 60,

  -- Audit fields
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  updated_by UUID,

  CONSTRAINT sfia_exact_match_valid CHECK (exact_match_points >= 0),
  CONSTRAINT sfia_above_demand_valid CHECK (above_demand_points >= 0),
  UNIQUE(company_id)
);

-- Seed defaults for all existing companies
INSERT INTO sfia_settings (company_id, sfia_enabled)
SELECT company_id, true FROM companies
ON CONFLICT (company_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_sfia_settings_company ON sfia_settings(company_id);
