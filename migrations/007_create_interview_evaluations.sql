-- Migration 007: Create interview_evaluations table
-- Order: Run SEVENTH - persists technical/final interview evaluation records

CREATE TABLE IF NOT EXISTS interview_evaluations (
  evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,              -- 'technical_interview', 'final_interview', etc.
  evaluator_id UUID,                        -- user_id of the HR Interviewer
  evaluator_name VARCHAR(255),

  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  recommendation VARCHAR(30) CHECK (recommendation IN ('pass', 'fail', 'hold')),

  technical_score INTEGER,
  communication_score INTEGER,
  culture_fit_score INTEGER,

  strengths TEXT,
  weaknesses TEXT,
  notes TEXT,

  evaluated_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_application ON interview_evaluations(application_id);
CREATE INDEX IF NOT EXISTS idx_eval_stage ON interview_evaluations(application_id, stage);

-- Rollback:
-- DROP TABLE IF EXISTS interview_evaluations CASCADE;
