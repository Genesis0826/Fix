-- Migration 003: Create extracted_cv_skills table
-- Stores SFIA skills parsed from applicant CVs via the Pillar integration.

CREATE TABLE IF NOT EXISTS extracted_cv_skills (
  extraction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profile(applicant_id) ON DELETE CASCADE,

  skill_name VARCHAR(255) NOT NULL,
  -- SFIA candidate level 1–4
  candidate_level INTEGER CHECK (candidate_level BETWEEN 1 AND 4),
  years_of_experience INTEGER DEFAULT 0,
  extracted_from VARCHAR(20) NOT NULL DEFAULT 'cv_text'
    CONSTRAINT chk_extracted_from CHECK (extracted_from IN ('cv_text', 'job_description')),
  -- Confidence 0.00 – 1.00
  confidence_score DECIMAL(3, 2) CHECK (confidence_score BETWEEN 0 AND 1),

  -- Full Pillar API response kept for auditing / debugging
  pillar_parse_response JSONB,

  extracted_at TIMESTAMP DEFAULT now(),
  extracted_by VARCHAR(50) DEFAULT 'pillar_service'
);

CREATE INDEX IF NOT EXISTS idx_extracted_cv_application ON extracted_cv_skills(application_id);
CREATE INDEX IF NOT EXISTS idx_extracted_cv_applicant ON extracted_cv_skills(applicant_id);
