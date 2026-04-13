-- Migration 010: Add ranking_status to job_applications
-- Provides an explicit applicant-facing status for Shortlisted / Not Shortlisted / On Hold.

ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS ranking_status VARCHAR(30) DEFAULT NULL
  CONSTRAINT chk_job_app_ranking_status CHECK (
    ranking_status IS NULL OR ranking_status IN ('shortlisted', 'not_shortlisted', 'on_hold')
  );

CREATE INDEX IF NOT EXISTS idx_job_app_ranking_status ON job_applications(ranking_status)
  WHERE ranking_status IS NOT NULL;
