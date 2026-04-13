-- Migration 001: Create sfia_settings table
-- Stores per-company SFIA ranking configuration with audit trail.
-- Run this FIRST before any other Sprint 3 migrations.

CREATE TABLE IF NOT EXISTS sfia_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  -- Feature toggles
  sfia_enabled BOOLEAN DEFAULT true NOT NULL,

  -- Scoring configuration
  exact_match_points DECIMAL(4, 2) DEFAULT 3.00 NOT NULL,
  above_demand_points DECIMAL(4, 2) DEFAULT 1.50 NOT NULL,

  -- Failover configuration
  failover_threshold_percentage INTEGER DEFAULT 50 NOT NULL,
  max_consecutive_failures INTEGER DEFAULT 2 NOT NULL,
  consecutive_failures INTEGER DEFAULT 0 NOT NULL,
  healthcheck_interval_seconds INTEGER DEFAULT 60 NOT NULL,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_by UUID,

  CONSTRAINT sfia_exact_match_valid CHECK (exact_match_points >= 0),
  CONSTRAINT sfia_above_demand_valid CHECK (above_demand_points >= 0),
  CONSTRAINT sfia_failover_threshold_valid CHECK (failover_threshold_percentage BETWEEN 0 AND 100),
  UNIQUE (company_id)
);

-- Create index for frequent per-company lookups
CREATE INDEX IF NOT EXISTS idx_sfia_settings_company ON sfia_settings(company_id);

-- Seed default settings for all existing companies
INSERT INTO sfia_settings (company_id, sfia_enabled)
SELECT company_id, true FROM companies
ON CONFLICT (company_id) DO NOTHING;
