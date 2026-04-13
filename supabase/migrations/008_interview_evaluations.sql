-- Migration 008: Create interview_evaluations table
-- Stores structured evaluation data submitted by interviewers after
-- technical and final-round interviews. HR Officers can retrieve these
-- records when making the final hiring decision.

CREATE TABLE IF NOT EXISTS interview_evaluations (
  evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(job_posting_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,

  -- Interview stage this evaluation covers
  stage TEXT NOT NULL CHECK (stage IN ('technical_interview', 'final_interview', 'first_interview')),

  -- Evaluator info
  evaluator_id UUID,                        -- user_id of the HR/Interviewer
  evaluator_name TEXT,                      -- denormalized for display

  -- Scores (all 1-5 scale)
  technical_score INTEGER CHECK (technical_score BETWEEN 1 AND 5),
  communication_score INTEGER CHECK (communication_score BETWEEN 1 AND 5),
  culture_fit_score INTEGER CHECK (culture_fit_score BETWEEN 1 AND 5),
  overall_score INTEGER CHECK (overall_score BETWEEN 1 AND 5),

  -- Recommendation
  recommendation TEXT CHECK (recommendation IN ('strong_hire', 'hire', 'no_hire', 'strong_no_hire', 'hold')),

  -- Free-text fields
  strengths TEXT,
  areas_for_improvement TEXT,
  additional_notes TEXT,

  -- Structured criteria (optional JSONB for future extensibility)
  criteria_scores JSONB,

  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evaluations_application
  ON interview_evaluations(application_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_company
  ON interview_evaluations(company_id, submitted_at DESC);
