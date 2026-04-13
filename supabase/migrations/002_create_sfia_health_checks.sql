-- Migration 002: Create sfia_health_checks table
-- Audit trail of SFIA health checks and failures (for monitoring dashboard).

CREATE TABLE IF NOT EXISTS sfia_health_checks (
  check_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  check_timestamp TIMESTAMP DEFAULT now(),
  pillar_status VARCHAR(20) CHECK (pillar_status IN ('healthy', 'unhealthy')),
  pillar_response_time_ms INTEGER,
  failure_count INTEGER,
  sfia_action VARCHAR(20) CHECK (sfia_action IN ('no_action', 'auto_disabled', 'auto_enabled')),

  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sfia_health_company ON sfia_health_checks(company_id, check_timestamp DESC);
