-- Migration 002: Create sfia_health_checks table (OPTIONAL - monitoring only)
-- Audit trail of Pillar health check results, used by the monitoring dashboard
-- and the auto-disable/auto-enable SFIA logic.

CREATE TABLE IF NOT EXISTS sfia_health_checks (
  check_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  check_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  pillar_status TEXT NOT NULL CHECK (pillar_status IN ('healthy', 'unhealthy')),
  pillar_response_time_ms INTEGER,
  failure_count INTEGER DEFAULT 0 NOT NULL,
  sfia_action TEXT NOT NULL DEFAULT 'no_action'
    CHECK (sfia_action IN ('no_action', 'auto_disabled', 'auto_enabled')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Index enables efficient dashboard queries ordered by most-recent check per company
CREATE INDEX IF NOT EXISTS idx_sfia_health_company
  ON sfia_health_checks(company_id, check_timestamp DESC);
