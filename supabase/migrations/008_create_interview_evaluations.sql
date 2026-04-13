-- Migration 008: Create interview_evaluations table
-- Stores HR Interviewer evaluations for technical/final interview rounds.

CREATE TABLE IF NOT EXISTS interview_evaluations (
  evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  stage VARCHAR(50) NOT NULL,
  -- e.g. 'first_interview', 'technical_interview', 'final_interview', 'hr_screening'

  interviewer_id UUID REFERENCES user_profile(user_id) ON DELETE SET NULL,
  interviewer_name VARCHAR(255),

  -- Ratings (1-5 scale)
  technical_score INTEGER CHECK (technical_score BETWEEN 1 AND 5),
  communication_score INTEGER CHECK (communication_score BETWEEN 1 AND 5),
  culture_fit_score INTEGER CHECK (culture_fit_score BETWEEN 1 AND 5),
  overall_score INTEGER CHECK (overall_score BETWEEN 1 AND 5),

  strengths TEXT,
  weaknesses TEXT,
  notes TEXT,

  recommendation VARCHAR(20)
    CHECK (recommendation IN ('pass', 'fail', 'hold', 'strong_pass')),

  metadata JSONB,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_eval_application
  ON interview_evaluations(application_id, stage);
