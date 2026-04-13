# Job Requisition Requirement Check

Date: 2026-04-13  
Scope: Sprint 3 job requisition workflow from your screenshot (System Admin -> Recruiter/Applicant parallel -> Interviewer -> HR Officer -> onboarding handoff), validated against current backend/frontend code.

## Summary
- Met: 10
- Partial: 8
- Not Met: 4

## Requirement Status Matrix

1. System Admin enables recruitment module for subscribed company tenant
- Status: Met
- Evidence: Lifecycle module definitions include recruitment and role permissions mapping.

2. System Admin creates HR Recruiter and HR Interviewer accounts with assigned recruitment permissions
- Status: Met
- Evidence: User/role management supports HR Recruiter and HR Interviewer roles and permission sets.

3. System Admin defines which recruitment features each HR persona can access
- Status: Partial
- Evidence: Permission model exists, but this check did not confirm a strict, dedicated per-stage restriction model specific to recruiter vs interviewer vs officer actions inside recruitment APIs.

4. System Admin configures applicant self-registration settings for applicant portal
- Status: Partial
- Evidence: Applicant self-registration endpoint exists and can scope by company; explicit admin-facing setting screen/controls for enabling/disabling self-registration per tenant were not confirmed here.

5. HR Recruiter views all submitted applications
- Status: Met
- Evidence: HR applications listing and detailed application endpoints are implemented.

6. HR Recruiter views AI-generated top candidate shortlist (top 20)
- Status: Met
- Evidence: Ranked candidates endpoint supports limit (default 20) with SFIA ranking output.

7. HR Recruiter views individual applicant profiles and CV
- Status: Met
- Evidence: Application detail returns applicant profile, resume metadata, and signed resume URL path handling.

8. HR Recruiter actions include Shortlisted / Rejected / On Hold
- Status: Partial
- Evidence: Rejected is implemented; pipeline status model is primarily submitted/screening/interview stages/hired/rejected. Explicit on_hold and shortlisted states were not clearly implemented as first-class status values.

9. HR Recruiter can choose ranking method (SFIA or manual)
- Status: Met
- Evidence: Ranked endpoint accepts mode and manual-rank endpoint persists manual ordering.

10. Recruiter handles Pillars fallback and recovery
- Status: Met
- Evidence: SFIA-disabled path auto-falls back to manual mode with fallback metadata in ranking response.

11. Recruiter schedules first interview / HR screening
- Status: Met
- Evidence: Interview schedule endpoint supports stage-based scheduling with applicant notifications.

12. On pass, recruiter handoff to HR Interviewer is tracked in recruitment timeline
- Status: Not Met
- Evidence: No explicit recruitment_timeline event model/endpoint was found in this audit.

13. Applicant submits application form and CV
- Status: Met
- Evidence: Apply-to-job flow and resume upload flow both exist.

14. SFIA/Pillars computes fit automatically after submission
- Status: Partial
- Evidence: SFIA scoring and ranking are implemented when ranking is requested; explicit immediate auto-trigger right at submission time was not conclusively verified.

15. Applicant receives email/in-app status notifications for shortlisted/rejected/on-hold
- Status: Partial
- Evidence: Interview scheduling and responses are notified; explicit complete status-notification coverage for shortlisted and on-hold was not fully verified.

16. HR Interviewer receives handoff and can review fallback context before interview
- Status: Partial
- Evidence: Shared HR access to ranked candidates and application detail exists, but interviewer-specific handoff artifacts/context object were not clearly identified.

17. HR Interviewer records technical/final interview evaluations (interview_evaluations)
- Status: Not Met
- Evidence: No explicit interview_evaluations persistence model was found in this audit.

18. HR Interviewer can move passing candidate to final interview and notify HR Officer
- Status: Partial
- Evidence: Status transitions exist; dedicated HR Officer notification + explicit timeline handoff event were not confirmed.

19. HR Officer can review full candidate profile and all three interview evaluations
- Status: Partial
- Evidence: Candidate profile and schedules are visible; formal persisted multi-stage evaluation records were not found.

20. HR Officer generates offer with compensation/benefits details and sends offer email
- Status: Not Met
- Evidence: No dedicated offer-letter/offer-email workflow was found in current recruitment code paths.

21. HR Officer finalizes hiring and system updates status to hired
- Status: Met
- Evidence: Status update path supports hired transition with one-hire-per-company enforcement.

22. Hiring triggers role migration to onboarding and sends onboarding/welcome access
- Status: Partial
- Evidence: Hired transition triggers onboarding session/record creation; explicit recruitment-stage welcome email + portal-link send from hiring step was not fully verified in this audit.

## Touchpoint Validation

1. Touchpoint In: Applicant submits to careers/job portal after company publishes requisition
- Status: Met
- Evidence: Public careers by slug endpoint + applicant registration/apply flow are implemented.

2. Touchpoint Out: Hired status triggers onboarding process start
- Status: Met
- Evidence: Hiring path invokes onboarding record/session creation and updates applicant onboarding state.

## Main Gaps to Close

1. Introduce first-class statuses for shortlisted and on_hold if required by your exact workflow language.
2. Add explicit recruitment_timeline event logging for handoffs (Recruiter -> Interviewer -> HR Officer).
3. Implement interview_evaluations persistence and retrieval for technical/final rounds.
4. Add formal offer management flow (offer draft, C&B fields, applicant e-sign/accept, offer email templates).
5. Add explicit applicant status notification coverage for all required status states.

## Notes

- The core requisition engine is present: posting, apply, ranking (SFIA/manual), interview scheduling, and hire-to-onboarding trigger.
- Most gaps are around governance artifacts (timeline/evaluation/offer workflows) rather than missing basic recruitment CRUD.
