# Sprint 3 Database Schema - Required Migrations

## Summary
This document outlines all database changes needed for Sprint 3 implementations:
- System Admin SFIA Configuration
- Auto-Deactivation & Health Checks
- Manual Ranking with Fallback

---

## Required Tables & Migrations

### 1. `sfia_settings` (NEW)
Stores SFIA ranking configuration per company with audit trail.

```sql
CREATE TABLE sfia_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  
  -- Feature toggles
  sfia_enabled BOOLEAN DEFAULT true,
  
  -- Scoring configuration
  exact_match_points DECIMAL(4, 2) DEFAULT 3.00,        -- Points for exact skill match
  above_demand_points DECIMAL(4, 2) DEFAULT 1.50,       -- Points when supply > demand
  
  -- Failover configuration
  failover_threshold_percentage INTEGER DEFAULT 50,     -- Auto-switch if match % below this
  max_consecutive_failures INTEGER DEFAULT 2,           -- Failures before auto-disable
  consecutive_failures INTEGER DEFAULT 0,               -- Current failure counter
  healthcheck_interval_seconds INTEGER DEFAULT 60,      -- Polling interval
  
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

-- Create index for frequent lookups
CREATE INDEX idx_sfia_settings_company ON sfia_settings(company_id);
```

---

### 2. `sfia_health_checks` (NEW - OPTIONAL)
Audit trail of SFIA health checks and failures (for monitoring dashboard).

```sql
CREATE TABLE sfia_health_checks (
  check_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  
  check_timestamp TIMESTAMP DEFAULT now(),
  pillar_status 'healthy' | 'unhealthy',
  pillar_response_time_ms INTEGER,
  failure_count INTEGER,
  sfia_action 'no_action' | 'auto_disabled' | 'auto_enabled',
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_sfia_health_company ON sfia_health_checks(company_id, check_timestamp DESC);
```

---

### 3. `extracted_cv_skills` (NEW)
Stores parsed SFIA skills from CVs (from Pillar integration).

```sql
CREATE TABLE extracted_cv_skills (
  extraction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profile(applicant_id) ON DELETE CASCADE,
  
  skill_name VARCHAR(255) NOT NULL,
  candidate_level INTEGER (1-4),                        -- SFIA level 1-4
  years_of_experience INTEGER DEFAULT 0,
  extracted_from 'cv_text' | 'job_description',
  confidence_score DECIMAL(3, 2),                       -- 0.00-1.00
  
  pillar_parse_response JSONB,                          -- Full Pillar response for audit
  
  extracted_at TIMESTAMP DEFAULT now(),
  extracted_by VARCHAR(50) DEFAULT 'pillar_service'
);

CREATE INDEX idx_extracted_cv_application ON extracted_cv_skills(application_id);
CREATE INDEX idx_extracted_cv_applicant ON extracted_cv_skills(applicant_id);
```

---

### 4. Modify `manual_ranking_history` (EXISTS - Add field)
Add tracking of why ranking changed (SFIA failure, manual override, etc.).

```sql
ALTER TABLE manual_ranking_history
ADD COLUMN reason VARCHAR(255),  -- 'pillar_failure', 'operator_override', 'sfia_disabled'
ADD COLUMN triggered_by VARCHAR(50);  -- NOTE: was `triggerred_by` in original spec (typo corrected)

-- Existing records default to 'manual_override'
UPDATE manual_ranking_history SET reason = 'manual_override' WHERE reason IS NULL;
```

---

### 5. Modify `job_application_sfia` (EXISTS - Add field)
Track whether candidate was ranked via SFIA or fallback.

```sql
ALTER TABLE job_application_sfia
ADD COLUMN ranking_source 'sfia_auto' | 'manual_fallback' | 'manual_override' DEFAULT 'sfia_auto';

-- Existing SFIA ranks are from auto-ranking
UPDATE job_application_sfia SET ranking_source = 'sfia_auto' WHERE ranking_mode = 'sfia';
UPDATE job_application_sfia SET ranking_source = 'manual_override' WHERE ranking_mode = 'manual';
```

---

### 6. Modify `applicant_profile` (EXISTS - Add CV fields)
Add resume URL tracking for Pillar parsing.

```sql
ALTER TABLE applicant_profile
ADD COLUMN resume_url VARCHAR(500),              -- Direct URL to CV for Pillar parsing
ADD COLUMN resume_parsed_at TIMESTAMP,           -- When Pillar last parsed this CV
ADD COLUMN cv_parsing_status 'pending' | 'completed' | 'failed' DEFAULT 'pending',
ADD COLUMN cv_parsing_error_message TEXT;

-- Create index for batch CV parsing jobs
CREATE INDEX idx_applicant_cv_pending ON applicant_profile(cv_parsing_status) WHERE cv_parsing_status = 'pending';
```

---

## Environment Variables

Add these to `.env`:

```env
# Pillar CV Parsing API
PILLAR_API_URL=https://api.pillarhr.com/v1
PILLAR_API_KEY=your_pillar_api_key_here

# SFIA Health Check Polling
SFIA_HEALTH_CHECK_INTERVAL_SECONDS=60
SFIA_MAX_CONSECUTIVE_FAILURES=2
SFIA_FAILOVER_THRESHOLD_PERCENTAGE=50

# Admin Notifications
ADMIN_NOTIFICATION_EMAIL=admin@company.com
```

---

## Migration Order

1. **First**: Create `sfia_settings` table + seed all companies
2. **Second**: Modify `job_application_sfia` with `ranking_source` field
3. **Third**: Create `extracted_cv_skills` table
4. **Fourth**: Modify `applicant_profile` with resume fields
5. **Fifth**: Create `sfia_health_checks` audit table (optional, monitoring only)
6. **Sixth**: Modify `manual_ranking_history` with reason tracking

---

## Rollback Plan

If any issue, these SQL commands revert changes:

```sql
-- Drop new tables
DROP TABLE IF EXISTS sfia_health_checks CASCADE;
DROP TABLE IF EXISTS extracted_cv_skills CASCADE;
DROP TABLE IF EXISTS sfia_settings CASCADE;

-- Drop new columns
ALTER TABLE job_application_sfia DROP COLUMN IF EXISTS ranking_source CASCADE;
ALTER TABLE applicant_profile DROP COLUMN IF EXISTS resume_url CASCADE;
ALTER TABLE applicant_profile DROP COLUMN IF EXISTS resume_parsed_at CASCADE;
ALTER TABLE applicant_profile DROP COLUMN IF EXISTS cv_parsing_status CASCADE;
ALTER TABLE applicant_profile DROP COLUMN IF EXISTS cv_parsing_error_message CASCADE;
ALTER TABLE manual_ranking_history DROP COLUMN IF EXISTS reason CASCADE;
ALTER TABLE manual_ranking_history DROP COLUMN IF EXISTS triggered_by CASCADE;
```

---

## Testing the Setup

```bash
# 1. Check sfia_settings created
select * from sfia_settings where company_id = 'your-company-id';

# 2. Verify defaults are sensible
select sfia_enabled, exact_match_points, above_demand_points, healthcheck_interval_seconds 
from sfia_settings limit 1;

# 3. Check indexes exist
select * from pg_stat_user_indexes where relname like 'idx_sfia%';
```

---

## Notes

- **sfia_settings** is the source of truth for SFIA configuration. Jobs service queries this on every ranking.
- **consecutive_failures** is auto-reset to 0 when Pillar health check passes.
- **extracted_cv_skills** stores Pillar responses for audit/debugging if needed.
- All tables cascade delete with company to keep data clean on company removal.
