-- Migration 003: Create extracted_cv_skills table
-- Stores SFIA skills parsed from candidate CVs via the Pillar integration.
-- Each row is linked to both the job application (per-posting) and the applicant
-- so that skill matches can be re-evaluated without re-parsing the CV.

CREATE TABLE IF NOT EXISTS extracted_cv_skills (
  extraction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profile(applicant_id) ON DELETE CASCADE,

  skill_name VARCHAR(255) NOT NULL,
  candidate_level INTEGER CHECK (candidate_level BETWEEN 1 AND 4),  -- SFIA levels 1-4
  years_of_experience INTEGER DEFAULT 0 NOT NULL,
  extracted_from TEXT NOT NULL DEFAULT 'cv_text'
    CHECK (extracted_from IN ('cv_text', 'job_description')),
  confidence_score DECIMAL(3, 2)
    CHECK (confidence_score BETWEEN 0.00 AND 1.00),

  -- Full Pillar API response stored for audit / re-processing
  pillar_parse_response JSONB,

  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  extracted_by VARCHAR(50) DEFAULT 'pillar_service' NOT NULL
);

-- Index for loading all skills for a given application
CREATE INDEX IF NOT EXISTS idx_extracted_cv_application
  ON extracted_cv_skills(application_id);

-- Index for loading all parsed skills for an applicant (cross-application view)
CREATE INDEX IF NOT EXISTS idx_extracted_cv_applicant
  ON extracted_cv_skills(applicant_id);
