# Onboarding Requirement Check

Date: 2026-04-13
Scope: Code-path validation (backend + frontend integrations) for the onboarding flow shown in the provided requirement images.

## Summary
- Met: 11
- Partial: 6
- Not Met: 1

## Requirement Status Matrix

1. System Admin enables onboarding module per subscribed company tenant
- Status: Met
- Evidence: Module visibility and onboarding module routes are present.

2. System Admin creates HR Onboarding Officer account after subscription setup
- Status: Partial
- Evidence: User/role management exists, but no single dedicated onboarding-officer provisioning flow was verified as a special onboarding bootstrap step.

3. System Admin defines required onboarding features (docs, tasks, deadlines) for the tenant
- Status: Met
- Evidence: Template creation and template item management endpoints exist.

4. System Admin monitors and audits all active HR onboarding accounts
- Status: Partial
- Evidence: General audit/role/user controls exist, but a dedicated onboarding-account audit dashboard/workflow was not explicitly verified.

5. System Admin views full onboarding activity logs across tenant
- Status: Partial
- Evidence: Audit infrastructure exists; full onboarding-specific activity log coverage/UI was not confirmed end-to-end.

6. System Admin can deactivate/revoke onboarding access for former/reassigned HR personnel
- Status: Partial
- Evidence: Role/access management exists in user management, but no onboarding-specific revoke flow was explicitly confirmed.

7. HR Onboarding Officer configures checklist template (documents/tasks/deadlines)
- Status: Met
- Evidence: System-admin template APIs and assignment APIs are implemented and consumable by onboarding UI flows.

8. HR Onboarding Officer sets default deadlines for onboarding tasks
- Status: Met
- Evidence: Template default_deadline_days + session deadline update endpoint exist.

9. HR Onboarding Officer receives notification when a new hire enters onboarding
- Status: Met
- Evidence: submitForReview flow sends HR notifications; onboarding notifications service integration is present.

10. HR Onboarding Officer views list of hired applicants ready for onboarding
- Status: Met
- Evidence: HR onboarding sessions listing endpoint and frontend API bindings exist.

11. HR Onboarding Officer selects hired applicant and initiates onboarding process
- Status: Met
- Evidence: Template assignment endpoint creates onboarding session + items.

12. System auto-generates Employee ID and Employee Number
- Status: Met
- Evidence: approveSession/user provisioning generates employee code and stores in user_profile.

13. System provisions system access and onboarding credentials for onboarding employee
- Status: Met
- Evidence: approveSession provisions user_profile + invite token + set-password email.

14. HR Onboarding Officer monitors progress across all active onboarding employees
- Status: Met
- Evidence: sessions include status/progress/deadline; recalculateProgress updates lifecycle state.

15. HR Onboarding Officer opens employee profile/checklist and tracks docs/tasks
- Status: Met
- Evidence: session detail endpoint returns grouped categories, profile, submissions, remarks.

16. HR Onboarding Officer reviews submitted docs and provides feedback
- Status: Met
- Evidence: updateItemStatus supports approved/rejected + remarks + notification/email to employee.

17. HR Onboarding Officer approves completion once 100% checklist complete
- Status: Partial
- Evidence: approveSession endpoint exists and finalizes session; strict pre-check that blocks approval unless 100% complete was not explicitly confirmed in code.

18. Employee status updates to Active Employee after onboarding approval
- Status: Met
- Evidence: approveSession provisions/updates user_profile account status and transitions applicant status to converted employee.

19. Approval triggers Compensation & Benefits stage
- Status: Not Met
- Evidence: No explicit downstream compensation-benefits module handoff event was found.

20. Touchpoint In: Job application marked as Hired triggers onboarding
- Status: Met
- Evidence: jobs updateApplicationStatus(hired) calls createOnboardingRecord/createApplicantSession and marks applicant onboarding state.

21. Touchpoint Out: HR approval finalizes onboarding and ends onboarding stage
- Status: Met
- Evidence: approveSession sets onboarding session status approved + completion timestamp and emits approval notifications.

## Employee-Side Flow Validation

1. Receives credentials/access after HR initiates onboarding
- Status: Partial
- Note: Current credential invite is sent on approval/provisioning path; initiation-time credential behavior may vary by tenant setup.

2. Can access onboarding portal and view onboarding stages/checklist tabs
- Status: Met
- Evidence: applicant onboarding portal/session APIs and frontend onboarding pages/components are present.

3. Can upload required documents with validation and get errors for invalid uploads
- Status: Met
- Evidence: uploadDocument validates file type and max size.

4. Can submit for HR review and see review/approved lifecycle state
- Status: Met
- Evidence: submitForReview + approval/rejection statuses and notifications are implemented.

## Main Gaps to Close

1. Add explicit onboarding-account administration workflow for onboarding officer lifecycle (audit + revoke) if required as a standalone feature.
2. Enforce strict 100% completion gate in approveSession if the business rule requires hard-block before final approval.
3. Implement explicit handoff/integration event for Compensation & Benefits stage after onboarding approval.
4. Clarify and align "credentials sent at initiation" vs "credentials sent at final approval" behavior.

## Notes

- The onboarding stack is mostly implemented and operational from API perspective.
- Most unmet risk is not missing CRUD, but missing strict policy gates and downstream stage integration.
