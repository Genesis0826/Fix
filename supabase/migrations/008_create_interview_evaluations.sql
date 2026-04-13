-- Migration 008: Create interview_evaluations table
-- Persists technical and final-round interview evaluations so HR Officers can
-- review scores and notes before making offer decisions.

CREATE TABLE IF NOT EXISTS interview_evaluations (
  evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(job_posting_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  interview_stage VARCHAR(50) NOT NULL,         -- 'technical', 'final', 'first_interview', etc.
  evaluated_by UUID NOT NULL,                   -- user_id of the interviewer / evaluator
  evaluator_name VARCHAR(255),

  -- Scores (out of 10 each, nullable if not scored)
  technical_score DECIMAL(4, 2) CHECK (technical_score BETWEEN 0 AND 10),
  communication_score DECIMAL(4, 2) CHECK (communication_score BETWEEN 0 AND 10),
  culture_fit_score DECIMAL(4, 2) CHECK (culture_fit_score BETWEEN 0 AND 10),
  overall_score DECIMAL(4, 2) CHECK (overall_score BETWEEN 0 AND 10),

  recommendation VARCHAR(30) DEFAULT 'pending'
    CONSTRAINT chk_recommendation CHECK (
      recommendation IN ('strong_hire', 'hire', 'hold', 'no_hire', 'pending')
    ),

  strengths TEXT,
  weaknesses TEXT,
  notes TEXT,

  evaluated_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_application ON interview_evaluations(application_id);
CREATE INDEX IF NOT EXISTS idx_eval_company ON interview_evaluations(company_id, evaluated_at DESC);
