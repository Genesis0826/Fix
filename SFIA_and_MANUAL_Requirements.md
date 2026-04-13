# SFIA Sprint 3 Requirement Check

Date: 2026-04-13
Scope: Backend + frontend behavior verified from code and runtime API checks.

## Summary
- Met: 7
- Partial: 3
- Not Met: 3

## Requirement-by-Requirement Status

1. System Admin can enable or disable SFIA per company
- Status: Met
- Notes: Toggle endpoint and service logic are present and wired.

2. System Admin can configure SFIA points and thresholds
- Status: Met
- Notes: DTO validation and update flow exist.

3. System Admin can create recruiter account and assign recruiter-level permissions
- Status: Partial
- Notes: User/role management exists in system, but this file does not confirm dedicated SFIA-specific recruiter provisioning flow end-to-end.

4. SFIA ranking activity is auditable across tenant/company
- Status: Partial
- Notes: SFIA settings updates are audit-logged; complete ranking event audit coverage is not fully verified for every ranking action path.

5. Applicant uploads CV with format and file-size validation
- Status: Met
- Notes: Resume upload enforces allowed MIME types and 5MB max.

6. CV upload is tied to specific job posting ID (job submission flow)
- Status: Not Met
- Notes: Current resume upload is profile-level, not tied to a job posting ID.

7. Pillars parsing auto-triggers after valid CV submission
- Status: Not Met
- Notes: Pillar service exists, but parse/extract is not currently invoked in resume upload flow.

8. Applicant receives submission confirmation
- Status: Partial
- Notes: Core application flow exists, but this check did not validate a dedicated confirmation event for CV-to-Pillars trigger path.

9. Applicant can see ranking status (Shortlisted / Not Shortlisted / On Hold)
- Status: Not Met
- Notes: Full explicit status notification/label mapping for all three states was not confirmed as an implemented end-to-end flow.

10. Pillars auto-ranking computes fit score and shows demand vs supply labels before first interview
- Status: Met (when demand skills exist)
- Notes: Runtime verified: jobs with demand skills return non-empty skill_breakdown and non-zero SFIA scoring.

11. Health checks poll Pillars every 60 seconds and auto-disable after consecutive failures
- Status: Met
- Notes: Scheduled polling and failure counter/auto-disable logic are implemented.

12. Fallback to manual ranking activates automatically without downtime
- Status: Met
- Notes: requested_mode vs actual_mode fallback logic is implemented.

13. Manual ranking persists and can override order
- Status: Met
- Notes: Manual rank endpoint updates DB and stores ranking history.

14. HR recruiter is notified by email/in-app on SFIA fallback failure events
- Status: Partial
- Notes: Notification infrastructure exists; SFIA fallback path currently logs warnings and does not yet show complete dedicated email/in-app failover notification implementation.

## Runtime Evidence Highlights

- Login endpoint works with rememberMe boolean payload.
- Ranked candidates endpoint returns expected demand/supply breakdown for jobs with demand skills.
- Jobs with required_skill_count = 0 naturally show 0% fit and empty breakdown.

## Key Gaps to Close

1. Wire Pillar parse/extract into applicant CV upload and/or application submission pipeline.
2. Add explicit job-posting linkage for CV processing where required by spec.
3. Implement explicit applicant-facing ranking-status pipeline for Shortlisted / Not Shortlisted / On Hold.
4. Add dedicated SFIA fallback notifications (email + in-app) to HR Recruiter path.

## Risk Note

The UI can look broken for jobs with no configured demand skills because fit becomes 0% and skill breakdown is empty by design. This is a data setup issue, not scoring-engine removal.
