import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PillarService } from '../pillar/pillar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { UpdateJobPostingDto } from './dto/update-job-posting.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationQuestionDto } from './dto/create-questions.dto';
import { GetRankedCandidatesDto } from './dto/get-ranked-candidates.dto';
import { ManualRankingItemDto } from './dto/save-manual-ranking.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { InterviewResponseDto } from './dto/interview-response.dto';
import { OnboardingService } from '../onboarding/onboarding.service';
import { AdminService } from '../admin/admin.service';

type RankingMode = 'sfia' | 'manual';

type SfiaDemandSkill = {
  skill_id: string;
  skill_name: string;
  required_level: number;
  weight: number;
};

type SfiaSupplySkill = {
  owner_key: string;
  skill_id: string;
  skill_name: string;
  candidate_level: number;
  match_score: number | null;
};

type SkillBreakdown = {
  sfia_skill_id: string;
  skill_name: string;
  demand_level: number;
  supply_level: number;
  points: number;
  matched: boolean;
};

type RankedCandidate = {
  application_id: string;
  applicant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  applicant_code: string | null;
  status: string;
  applied_at: string;
  sfia_match_percentage: number;
  sfia_rank: number;
  manual_rank_position: number | null;
  effective_rank: number;
  skill_breakdown: SkillBreakdown[];
};

type RankedApplicationRow = {
  application_id: string;
  job_posting_id: string;
  applicant_id: string;
  status: string;
  application_timestamp: string;
  pre_screening_score: number | null;
  sfia_matching_percentage: number | null;
  manual_rank_position: number | null;
  ranking_mode: string;
};

type ApplicantProfileRow = {
  applicant_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  applicant_code: string | null;
};

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly onboardingService: OnboardingService,
    private readonly adminService: AdminService,
    private readonly pillarService: PillarService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // HR-facing methods — all scoped by companyId from JWT
  // ---------------------------------------------------------------------------

  async createPosting(dto: CreateJobPostingDto, companyId: string, performedBy: string) {
    const supabase = this.supabaseService.getClient();
    const job_posting_id = crypto.randomUUID();

    const { data, error } = await supabase
      .from('job_postings')
      .insert({
        job_posting_id,
        company_id: companyId,
        title: dto.title,
        description: dto.description,
        location: dto.location ?? null,
        employment_type: dto.employment_type ?? null,
        salary_range: dto.salary_range ?? null,
        department_id: dto.department_id ?? null,
        closes_at: dto.closes_at ?? null,
        status: 'open',
        posted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    await this.auditService.log(
      `Job posting created: "${dto.title}"`,
      performedBy,
      companyId,
    );

    return data;
  }

  async findAllPostings(companyId: string) {
    const supabase = this.supabaseService.getClient();

    // Auto-close any open postings whose closes_at has passed
    const now = new Date().toISOString();
    await supabase
      .from('job_postings')
      .update({ status: 'closed' })
      .eq('company_id', companyId)
      .eq('status', 'open')
      .not('closes_at', 'is', null)
      .lt('closes_at', now);

    const { data, error } = await supabase
      .from('job_postings')
      .select('*, job_applications(count)')
      .eq('company_id', companyId)
      .order('posted_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((row: any) => ({
      ...row,
      applicant_count: (row.job_applications as { count: number }[])?.[0]?.count ?? 0,
      job_applications: undefined,
    }));
  }

  async findOnePosting(jobPostingId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('job_posting_id', jobPostingId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Job posting not found');
    return data;
  }

  async updatePosting(jobPostingId: string, dto: UpdateJobPostingDto, companyId: string, performedBy: string) {
    const supabase = this.supabaseService.getClient();

    const existing = await this.findOnePosting(jobPostingId, companyId);

    const updateFields: Record<string, any> = {};
    if (dto.title !== undefined) updateFields.title = dto.title;
    if (dto.description !== undefined) updateFields.description = dto.description;
    if (dto.location !== undefined) updateFields.location = dto.location;
    if (dto.employment_type !== undefined) updateFields.employment_type = dto.employment_type;
    if (dto.salary_range !== undefined) updateFields.salary_range = dto.salary_range;
    if (dto.department_id !== undefined) updateFields.department_id = dto.department_id;
    if (dto.closes_at !== undefined) updateFields.closes_at = dto.closes_at;
    if (dto.status !== undefined) updateFields.status = dto.status;

    const { data, error } = await supabase
      .from('job_postings')
      .update(updateFields)
      .eq('job_posting_id', jobPostingId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // Build a human-readable summary of what changed
    const changedFields = Object.keys(updateFields);
    const statusChange = dto.status && dto.status !== existing.status
      ? ` (status: ${existing.status} → ${dto.status})`
      : '';
    await this.auditService.log(
      `Job posting updated: "${existing.title}" - fields: ${changedFields.join(', ')}${statusChange}`,
      performedBy,
      companyId,
    );

    return data;
  }

  async closePosting(jobPostingId: string, companyId: string, performedBy: string) {
    const supabase = this.supabaseService.getClient();

    const existing = await this.findOnePosting(jobPostingId, companyId);

    const { error } = await supabase
      .from('job_postings')
      .update({ status: 'closed' })
      .eq('job_posting_id', jobPostingId)
      .eq('company_id', companyId);

    if (error) throw new InternalServerErrorException(error.message);

    await this.auditService.log(
      `Job posting closed: "${existing.title}"`,
      performedBy,
      companyId,
    );

    return { message: 'Job posting closed successfully' };
  }

  // ---------------------------------------------------------------------------
  // Application questions — HR manages, applicants read
  // ---------------------------------------------------------------------------

  async setQuestionsForPosting(jobPostingId: string, questions: ApplicationQuestionDto[], companyId: string, performedBy: string) {
    const supabase = this.supabaseService.getClient();

    // Verify job ownership
    const existing = await this.findOnePosting(jobPostingId, companyId);

    // Replace all existing questions
    await supabase.from('application_questions').delete().eq('job_posting_id', jobPostingId);

    if (questions.length === 0) {
      await this.auditService.log(
        `Application form cleared: job "${existing.title}"`,
        performedBy,
        companyId,
      );
      return [];
    }

    const rows = questions.map((q, i) => ({
      question_id: crypto.randomUUID(),
      job_posting_id: jobPostingId,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options ?? null,
      is_required: q.is_required ?? true,
      sort_order: q.sort_order ?? i,
    }));

    const { data, error } = await supabase
      .from('application_questions')
      .insert(rows)
      .select();

    if (error) throw new InternalServerErrorException(error.message);

    await this.auditService.log(
      `Application form updated: job "${existing.title}" - ${questions.length} question(s) set`,
      performedBy,
      companyId,
    );

    return data ?? [];
  }

  async getQuestionsForPosting(jobPostingId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('application_questions')
      .select('question_id, question_text, question_type, options, is_required, sort_order')
      .eq('job_posting_id', jobPostingId)
      .order('sort_order');

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  // ---------------------------------------------------------------------------
  // Applications — HR view
  // ---------------------------------------------------------------------------

  async getApplicationsForJob(jobPostingId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    await this.findOnePosting(jobPostingId, companyId);

    const { data: regularApps, error: regularError } = await supabase
      .from('job_applications')
      .select(`
        application_id,
        status,
        applied_at,
        applicant_id,
        applicant_profile (
          first_name,
          last_name,
          email,
          phone_number,
          applicant_code
        )
      `)
      .eq('job_posting_id', jobPostingId)
      .order('applied_at', { ascending: false });

    if (regularError) throw new InternalServerErrorException(regularError.message);

    const { data: sfiaApps, error: sfiaError } = await supabase
      .from('job_application_sfia')
      .select('application_id, status, application_timestamp, applicant_id')
      .eq('job_posting_id', jobPostingId)
      .order('application_timestamp', { ascending: false });

    if (sfiaError) {
      this.logger.warn(`Unable to fetch SFIA applications for job ${jobPostingId}: ${sfiaError.message}`);
    }

    const regularIds = new Set((regularApps ?? []).map((a: { application_id: string }) => a.application_id));

    const uniqueSfiaApps = (sfiaApps ?? []).filter(
      (a: { application_id: string }) => !regularIds.has(a.application_id),
    );

    let sfiaProfiles: ApplicantProfileRow[] = [];
    if (uniqueSfiaApps.length > 0) {
      const applicantIds = uniqueSfiaApps.map((a: { applicant_id: string }) => a.applicant_id);
      const { data: profiles } = await supabase
        .from('applicant_profile')
        .select('applicant_id, first_name, last_name, email, phone_number, applicant_code')
        .in('applicant_id', applicantIds);
      sfiaProfiles = (profiles ?? []) as ApplicantProfileRow[];
    }

    const profileMap = new Map(sfiaProfiles.map((p) => [p.applicant_id, p]));

    const normalizedSfiaApps = uniqueSfiaApps.map(
      (a: { application_id: string; status: string; application_timestamp: string; applicant_id: string }) => ({
        application_id: a.application_id,
        status: a.status?.toLowerCase() ?? 'submitted',
        applied_at: a.application_timestamp,
        applicant_id: a.applicant_id,
        // Safe fallback so frontend never receives null and crashes on destructure
        applicant_profile: profileMap.get(a.applicant_id) ?? {
          applicant_id: a.applicant_id,
          first_name: 'Unknown',
          last_name: 'Applicant',
          email: '',
          phone_number: null,
          applicant_code: null,
        },
      }),
    );

    return [...(regularApps ?? []), ...normalizedSfiaApps].sort(
      (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime(),
    );
  }

  async getRankedCandidates(
    jobPostingId: string,
    companyId: string,
    query: GetRankedCandidatesDto,
  ) {
    let requestedMode: RankingMode = query.mode ?? 'sfia';
    const limit = query.limit ?? 20;

    const job = await this.findOnePosting(jobPostingId, companyId);
    const applications = await this.getRankedApplicationRows(jobPostingId, companyId);
    const demandSkills = await this.getJobDemandSkills(jobPostingId);

    // Check if SFIA is enabled and healthy
    const sfiaSettings = await this.adminService.getSfiaSettings(companyId);
    let actualMode: RankingMode = requestedMode;
    let fallbackReason: string | null = null;

    // If SFIA was requested but disabled or failed health checks, auto-fallback to manual
    if (requestedMode === 'sfia') {
      if (!sfiaSettings.sfia_enabled) {
        actualMode = 'manual';
        fallbackReason = 'SFIA disabled by administrator or auto-disabled due to system failures';
        this.logger.warn(
          `⚠️ SFIA ranking disabled for job ${jobPostingId}. Falling back to manual ranking.`,
        );

        // Notify all HR Recruiters/Officers in-app about the SFIA fallback
        this.notificationsService.notifyAllHRInCompany(companyId, {
          type: 'SFIA_FALLBACK',
          title: 'SFIA Ranking Unavailable — Manual Ranking Active',
          message: `SFIA auto-ranking is currently disabled for job posting ${jobPostingId}. Candidates are being ranked manually. Reason: ${fallbackReason}`,
          metadata: { job_posting_id: jobPostingId, reason: fallbackReason },
        }).catch(() => {});

        // Send email notification to admin/recruiter
        this.mailService.sendSfiaFallbackNotification({
          companyId,
          jobPostingId,
          reason: fallbackReason,
          consecutiveFailures: sfiaSettings.consecutive_failures,
        }).catch(() => {});
      }
    }

    const ranked = await this.buildRankedCandidates(
      jobPostingId,
      applications,
      demandSkills,
      companyId,
    );

    // Check if any candidates are below failover threshold
    const belowThreshold = ranked.filter(
      (c) => c.sfia_match_percentage < sfiaSettings.failover_threshold_percentage,
    );

    if (requestedMode === 'sfia' && belowThreshold.length > 0 && !fallbackReason) {
      this.logger.warn(
        `⚠️ ${belowThreshold.length} candidates below SFIA threshold (${sfiaSettings.failover_threshold_percentage}%) for job ${jobPostingId}`,
      );
    }

    const sfiaRanked = ranked.map((candidate, index) => ({
      ...candidate,
      sfia_rank: index + 1,
    }));

    // Apply ranking mode (SFIA auto or manual fallback)
    const manuallyRanked = this.sortCandidatesByMode(sfiaRanked, actualMode).map(
      (candidate, index) => ({
        ...candidate,
        effective_rank: index + 1,
      }),
    );

    return {
      job_posting_id: jobPostingId,
      title: job.title,
      requested_mode: requestedMode,
      actual_mode: actualMode,
      fallback_reason: fallbackReason,
      ranking_mode: actualMode,
      total_candidates: manuallyRanked.length,
      top_count: Math.min(limit, manuallyRanked.length),
      required_skill_count: demandSkills.length,
      sfia_enabled: sfiaSettings.sfia_enabled,
      sfia_consecutive_failures: sfiaSettings.consecutive_failures,
      candidates: manuallyRanked.slice(0, limit),
    };
  }

  async saveManualRanking(
    jobPostingId: string,
    companyId: string,
    performedBy: string,
    rankings: ManualRankingItemDto[],
  ) {
    const supabase = this.supabaseService.getClient();

    const jobPosting = await this.findOnePosting(jobPostingId, companyId);

    const { data: applications, error: applicationsError } = await supabase
      .from('job_application_sfia')
      .select('application_id, manual_rank_position')
      .eq('job_posting_id', jobPostingId);

    if (applicationsError) {
      throw new InternalServerErrorException(applicationsError.message);
    }

    const validApplicationIds = new Set(
      (applications ?? []).map((row: { application_id: string }) => row.application_id),
    );

    const uniqueIds = new Set<string>();
    const uniqueRanks = new Set<number>();
    for (const item of rankings) {
      if (!validApplicationIds.has(item.application_id)) {
        throw new BadRequestException(
          `Application ${item.application_id} does not belong to this job posting`,
        );
      }
      if (uniqueIds.has(item.application_id)) {
        throw new BadRequestException('Duplicate application_id in manual ranking payload');
      }
      if (uniqueRanks.has(item.rank)) {
        throw new BadRequestException('Duplicate rank values are not allowed');
      }
      uniqueIds.add(item.application_id);
      uniqueRanks.add(item.rank);
    }

    const updates = rankings.map((item) =>
      supabase
        .from('job_application_sfia')
        .update({ manual_rank_position: item.rank, ranking_mode: 'MANUAL' })
        .eq('job_posting_id', jobPostingId)
        .eq('application_id', item.application_id),
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      throw new InternalServerErrorException(failed.error.message);
    }

    const previousRankMap = new Map(
      (applications ?? []).map((row: { application_id: string; manual_rank_position: number | null }) => [
        row.application_id,
        row.manual_rank_position,
      ]),
    );

    const historyRows = rankings.map((item) => ({
      history_id: crypto.randomUUID(),
      application_id: item.application_id,
      performed_by: performedBy,
      previous_rank: previousRankMap.get(item.application_id) ?? null,
      new_rank: item.rank,
      changed_at: new Date().toISOString(),
      reason: 'operator_override',
      triggered_by: performedBy,
    }));

    const { error: historyError } = await supabase
      .from('manual_ranking_history')
      .insert(historyRows);

    if (historyError) {
      throw new InternalServerErrorException(historyError.message);
    }

    await this.auditService.log(
      `Manual candidate ranking saved for "${jobPosting.title}" (${rankings.length} candidate(s))`,
      performedBy,
      companyId,
    );

    return {
      message: 'Manual ranking saved successfully',
      job_posting_id: jobPostingId,
      updated_count: rankings.length,
    };
  }

  async getApplicationDetail(applicationId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error } = await supabase
      .from('job_applications')
      .select(`
        application_id, status, applied_at, job_posting_id,
        applicant_profile (first_name, last_name, email, phone_number, applicant_code, resume_url, resume_name, resume_uploaded_at)
      `)
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!app) throw new NotFoundException('Application not found');

    // Verify job belongs to this company
    await this.findOnePosting(app.job_posting_id, companyId);

    // Get answers joined with question info
    const { data: answers } = await supabase
      .from('applicant_answers')
      .select(`
        answer_id, answer_value,
        application_questions (question_id, question_text, question_type, options, sort_order)
      `)
      .eq('application_id', applicationId)
      .order('application_questions(sort_order)');

    // Get all interview schedules for this application, keyed by stage
    const { data: schedules } = await supabase
      .from('interview_schedules')
      .select('application_id, stage, scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes, created_at, applicant_response, applicant_response_note, applicant_responded_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    // Build a map: stage → schedule. Also expose the latest as interview_schedule for backwards compat.
    const interview_schedules: Record<string, any> = {};
    for (const s of (schedules ?? [])) {
      const key = s.stage ?? 'first_interview';
      interview_schedules[key] = s;
    }
    const latestSchedule = (schedules ?? [])[0] ?? null;

    // Generate a signed URL for the resume if it's stored as a file path
    const profile = (app as any).applicant_profile as Record<string, any> | null;
    if (profile?.resume_url && !profile.resume_url.startsWith('https://')) {
      const { data: urlData } = await supabase.storage
        .from('applicant-resumes')
        .createSignedUrl(profile.resume_url, 60 * 60 * 24 * 7);
      if (urlData?.signedUrl) {
        (app as any).applicant_profile = { ...profile, resume_url: urlData.signedUrl };
      }
    }

    return {
      ...app,
      answers: answers ?? [],
      interview_schedule: latestSchedule,
      interview_schedules,
    };
  }

  // NOSONAR: Complex method needed for application status workflow - requires refactoring in future sprint
  async updateApplicationStatus(applicationId: string, status: string, companyId: string, performedBy?: string, performerRole?: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id, status')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);

    if (app) {
      await this.findOnePosting(app.job_posting_id, companyId);
      await this.validateAndUpdateRegularApplication(app, status, companyId, applicationId, supabase);

      // Log recruitment timeline event for traceability
      void this.logTimelineEvent({
        applicationId,
        jobPostingId: app.job_posting_id,
        companyId,
        performedBy: performedBy ?? null,
        performerRole: performerRole ?? null,
        eventType: this.resolveTimelineEventType(status),
        fromStatus: app.status,
        toStatus: status,
      });

      // Notify applicant of explicit ranking statuses
      void this.notifyApplicantOfStatusChange(applicationId, app.applicant_id, status);

      return { message: 'Application status updated' };
    }

    // Fall back to SFIA applications table
    await this.validateAndUpdateSfiaApplication(applicationId, status, companyId, supabase);

    // Log timeline event for SFIA application status change
    const { data: sfiaApp } = await supabase
      .from('job_application_sfia')
      .select('job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (sfiaApp) {
      void this.logTimelineEvent({
        applicationId,
        jobPostingId: sfiaApp.job_posting_id,
        companyId,
        performedBy: performedBy ?? null,
        performerRole: performerRole ?? null,
        eventType: this.resolveTimelineEventType(status),
        fromStatus: null,
        toStatus: status,
      });
      void this.notifyApplicantOfStatusChange(applicationId, sfiaApp.applicant_id, status);
    }

    return { message: 'Application status updated' };
  }

  /**
   * Map an application status value to a timeline event type.
   */
  private resolveTimelineEventType(status: string): string {
    const s = status.toLowerCase();
    if (s === 'hired') return 'hired';
    if (s === 'rejected' || s === 'not_shortlisted') return 'rejected';
    if (s === 'shortlisted') return 'status_change';
    if (s === 'on_hold') return 'status_change';
    if (s.includes('interview')) return 'interview_scheduled';
    if (s === 'offer_sent') return 'offer_sent';
    return 'status_change';
  }

  /**
   * Persist a recruitment_timeline_events row (fire-and-forget; never throws).
   */
  private async logTimelineEvent(opts: {
    applicationId: string;
    jobPostingId: string;
    companyId: string;
    performedBy: string | null;
    performerRole: string | null;
    eventType: string;
    fromStatus: string | null;
    toStatus: string;
    notes?: string;
  }): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      await supabase.from('recruitment_timeline_events').insert({
        event_id: crypto.randomUUID(),
        application_id: opts.applicationId,
        job_posting_id: opts.jobPostingId,
        company_id: opts.companyId,
        performed_by: opts.performedBy,
        performer_role: opts.performerRole,
        event_type: opts.eventType,
        from_status: opts.fromStatus,
        to_status: opts.toStatus,
        notes: opts.notes ?? null,
        occurred_at: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`[Timeline] Failed to log event for application ${opts.applicationId}: ${(err as Error).message}`);
    }
  }

  /**
   * Send in-app notification to applicant when their ranking status changes to
   * shortlisted, not_shortlisted, or on_hold (explicit applicant-facing statuses).
   * Fire-and-forget — never throws.
   */
  private async notifyApplicantOfStatusChange(
    applicationId: string,
    applicantId: string,
    status: string,
  ): Promise<void> {
    const s = status.toLowerCase();
    if (!['shortlisted', 'not_shortlisted', 'on_hold'].includes(s)) return;

    const titleMap: Record<string, string> = {
      shortlisted:     'Congratulations — you have been shortlisted!',
      not_shortlisted: 'Application update',
      on_hold:         'Application on hold',
    };
    const messageMap: Record<string, string> = {
      shortlisted:     'You have been shortlisted for the position. HR will be in touch with next steps.',
      not_shortlisted: 'Thank you for your application. After careful consideration, we will not be moving forward at this time.',
      on_hold:         'Your application has been placed on hold. We will reach out when the position moves forward.',
    };

    try {
      const supabase = this.supabaseService.getClient();

      // Retrieve applicant's company_id for notification scoping
      const { data: profile } = await supabase
        .from('applicant_profile')
        .select('company_id, email, first_name, last_name')
        .eq('applicant_id', applicantId)
        .maybeSingle();

      if (!profile?.company_id) return;

      await this.notificationsService.createNotification({
        userId: applicantId,
        companyId: profile.company_id,
        type: `APPLICATION_${s.toUpperCase()}`,
        title: titleMap[s],
        message: messageMap[s],
        metadata: { application_id: applicationId },
      });

      // Send email notification for shortlisted/not_shortlisted statuses
      if (profile.email && (s === 'shortlisted' || s === 'not_shortlisted')) {
        const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
        this.mailService.sendApplicationStatusEmail({
          to: profile.email,
          applicantName,
          status: s as 'shortlisted' | 'not_shortlisted',
        }).catch(() => {});
      }
    } catch (err) {
      this.logger.warn(`[StatusNotify] Failed for applicant ${applicantId}: ${(err as Error).message}`);
    }
  }

  private async validateAndUpdateRegularApplication(
    app: any,
    status: string,
    companyId: string,
    applicationId: string,
    supabase: any,
  ) {
    const isHired = status === 'hired';

    if (isHired) {
      await this.enforceOneHirePerCompanyConstraint(app.applicant_id, companyId, applicationId, supabase);
    }

    const { error } = await supabase
      .from('job_applications')
      .update({ status })
      .eq('application_id', applicationId);

    if (error) throw new InternalServerErrorException(error.message);

    if (isHired) {
      await this.handleHiredApplicationOnboarding(app, companyId);
    }
  }

  private async enforceOneHirePerCompanyConstraint(
    applicantId: string,
    companyId: string,
    applicationId: string,
    supabase: any,
  ) {
    const { data: hiredApps } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
      .eq('applicant_id', applicantId)
      .eq('status', 'hired')
      .neq('application_id', applicationId);

    if (!hiredApps || hiredApps.length === 0) return;

    const hiredPostingIds = hiredApps.map((a: any) => a.job_posting_id);
    const { data: inSameCompany } = await supabase
      .from('job_postings')
      .select('job_posting_id')
      .in('job_posting_id', hiredPostingIds)
      .eq('company_id', companyId)
      .limit(1);

    if (inSameCompany && inSameCompany.length > 0) {
      throw new ConflictException(
        'This applicant has already been hired for a position at this company. An applicant can only be hired once per company.',
      );
    }
  }

  private async handleHiredApplicationOnboarding(app: any, companyId: string) {
    await this.onboardingService.createOnboardingRecord({
      applicationId: app.application_id,
      applicantId:   app.applicant_id,
      jobPostingId:  app.job_posting_id,
      companyId,
    });
    await this.onboardingService.createApplicantSession({
      applicantId:  app.applicant_id,
      jobPostingId: app.job_posting_id,
      companyId,
    });
    const supabase = this.supabaseService.getClient();
    await supabase
      .from('applicant_profile')
      .update({ status: 'onboarding' })
      .eq('applicant_id', app.applicant_id);
  }

  private async validateAndUpdateSfiaApplication(
    applicationId: string,
    status: string,
    companyId: string,
    supabase: any,
  ) {
    const { data: sfiaApp, error: sfiaAppError } = await supabase
      .from('job_application_sfia')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (sfiaAppError) throw new InternalServerErrorException(sfiaAppError.message);
    if (!sfiaApp) throw new NotFoundException('Application not found');

    await this.findOnePosting(sfiaApp.job_posting_id, companyId);

    const { error: sfiaUpdateError } = await supabase
      .from('job_application_sfia')
      .update({ status: status.toUpperCase() })
      .eq('application_id', applicationId);

    if (sfiaUpdateError) throw new InternalServerErrorException(sfiaUpdateError.message);

    // Mirror the regular-application hired flow: create onboarding records for SFIA hires
    if (status === 'hired' && sfiaApp.applicant_id) {
      await this.handleSfiaHiredApplicationOnboarding(sfiaApp, companyId);
    }
  }

  private async handleSfiaHiredApplicationOnboarding(sfiaApp: any, companyId: string) {
    try {
      await this.onboardingService.createOnboardingRecord({
        applicationId: sfiaApp.application_id,
        applicantId:   sfiaApp.applicant_id,
        jobPostingId:  sfiaApp.job_posting_id,
        companyId,
      });
      await this.onboardingService.createApplicantSession({
        applicantId:  sfiaApp.applicant_id,
        jobPostingId: sfiaApp.job_posting_id,
        companyId,
      });
      const supabase = this.supabaseService.getClient();
      await supabase
        .from('applicant_profile')
        .update({ status: 'onboarding' })
        .eq('applicant_id', sfiaApp.applicant_id);
    } catch (err) {
      this.logger.error(`[updateApplicationStatus] Failed to create onboarding for SFIA hire: ${(err as Error).message}`);
    }
  }

  async scheduleInterview(applicationId: string, dto: ScheduleInterviewDto, companyId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify application belongs to this company
    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id, status')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    // Upsert per stage — one schedule row per (application, stage)
    // NOTE: Supabase requires a unique constraint on (application_id, stage) for this to work.
    // Run this migration if not already done:
    //   ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'first_interview';
    //   CREATE UNIQUE INDEX IF NOT EXISTS interview_schedules_app_stage_key ON interview_schedules (application_id, stage);
    const stage = dto.stage ?? 'first_interview';

    // Detect reschedule: check if a schedule already exists for this stage
    const { data: existingSchedule } = await supabase
      .from('interview_schedules')
      .select('schedule_id')
      .eq('application_id', applicationId)
      .eq('stage', stage)
      .maybeSingle();
    const isReschedule = !!existingSchedule;

    const scheduleId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('interview_schedules')
      .upsert({
        schedule_id:        scheduleId,
        application_id:     applicationId,
        company_id:         companyId,
        stage,
        scheduled_date:     dto.scheduled_date,
        scheduled_time:     dto.scheduled_time,
        duration_minutes:   dto.duration_minutes,
        format:             dto.format,
        location:           dto.location ?? null,
        meeting_link:       dto.meeting_link ?? null,
        interviewer_name:   dto.interviewer_name,
        interviewer_title:  dto.interviewer_title ?? null,
        notes:              dto.notes ?? null,
        scheduled_by_email: dto.scheduled_by_email ?? null,
        // Reset applicant response on reschedule
        applicant_response:      null,
        applicant_response_note: null,
        applicant_responded_at:  null,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'application_id,stage' });

    if (insertError) throw new InternalServerErrorException(insertError.message);

    // Update application status to match the scheduled stage so the
    // applicant's notification bell reflects the current interview stage.
    await supabase
      .from('job_applications')
      .update({ status: stage })
      .eq('application_id', applicationId);

    // Fetch applicant info for the email
    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email')
      .eq('applicant_id', app.applicant_id)
      .maybeSingle();

    const { data: posting } = await supabase
      .from('job_postings')
      .select('title')
      .eq('job_posting_id', app.job_posting_id)
      .maybeSingle();

    if (profile?.email) {
      const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
      const stageLabelMap: Record<string, string> = {
        first_interview:     '1st Interview',
        technical_interview: 'Technical Interview',
        final_interview:     'Final Interview',
      };
      await this.mailService.sendInterviewScheduleEmail({
        to:               profile.email,
        applicantName,
        jobTitle:         posting?.title ?? 'the position',
        stageLabel:       stageLabelMap[stage] ?? stage,
        isReschedule,
        scheduledDate:    dto.scheduled_date,
        scheduledTime:    dto.scheduled_time,
        durationMinutes:  dto.duration_minutes,
        format:           dto.format,
        location:         dto.location,
        meetingLink:      dto.meeting_link,
        interviewerName:  dto.interviewer_name,
        interviewerTitle: dto.interviewer_title,
        notes:            dto.notes,
      });
    }

    await this.auditService.log(
      `Interview scheduled for application ${applicationId} on ${dto.scheduled_date} at ${dto.scheduled_time}`,
      'system',
      companyId,
    );

    return { message: 'Interview scheduled and email sent', schedule_id: scheduleId };
  }

  async cancelInterviewSchedule(applicationId: string, stage: string, companyId: string, reason?: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    // Find the schedule for this specific stage
    const { data: schedule } = await supabase
      .from('interview_schedules')
      .select('scheduled_date, scheduled_time, duration_minutes, format')
      .eq('application_id', applicationId)
      .eq('stage', stage)
      .maybeSingle();

    if (!schedule) {
      // No schedule found — nothing to cancel, just return success
      return { message: 'No schedule found for this stage' };
    }

    // Delete the schedule row for this stage
    const { error: deleteError } = await supabase
      .from('interview_schedules')
      .delete()
      .eq('application_id', applicationId)
      .eq('stage', stage);

    if (deleteError) throw new InternalServerErrorException(deleteError.message);

    // Send cancellation email to applicant
    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email')
      .eq('applicant_id', app.applicant_id)
      .maybeSingle();

    const { data: posting } = await supabase
      .from('job_postings')
      .select('title')
      .eq('job_posting_id', app.job_posting_id)
      .maybeSingle();

    const stageLabelMap: Record<string, string> = {
      first_interview:     '1st Interview',
      technical_interview: 'Technical Interview',
      final_interview:     'Final Interview',
    };

    if (profile?.email) {
      const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
      await this.mailService.sendInterviewCancellationEmail({
        to:            profile.email,
        applicantName,
        jobTitle:      posting?.title ?? 'the position',
        scheduledDate: schedule.scheduled_date,
        scheduledTime: schedule.scheduled_time,
        stageLabel:    stageLabelMap[stage] ?? stage,
        reason:        reason ?? null,
      });
    }

    await this.auditService.log(
      `Interview schedule cancelled for application ${applicationId}, stage: ${stage}`,
      'system',
      companyId,
    );

    return { message: 'Interview schedule cancelled and applicant notified' };
  }

  async resendInterviewEmail(applicationId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    const { data: schedule, error: schedError } = await supabase
      .from('interview_schedules')
      .select('scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (schedError) throw new InternalServerErrorException(schedError.message);
    if (!schedule) throw new NotFoundException('No interview schedule found for this application');

    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email')
      .eq('applicant_id', app.applicant_id)
      .maybeSingle();

    const { data: posting } = await supabase
      .from('job_postings')
      .select('title')
      .eq('job_posting_id', app.job_posting_id)
      .maybeSingle();

    if (!profile?.email) throw new NotFoundException('Applicant email not found');

    const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
    await this.mailService.sendInterviewScheduleEmail({
      to:               profile.email,
      applicantName,
      jobTitle:         posting?.title ?? 'the position',
      scheduledDate:    schedule.scheduled_date,
      scheduledTime:    schedule.scheduled_time,
      durationMinutes:  schedule.duration_minutes,
      format:           schedule.format,
      location:         schedule.location,
      meetingLink:      schedule.meeting_link,
      interviewerName:  schedule.interviewer_name,
      interviewerTitle: schedule.interviewer_title,
      notes:            schedule.notes,
    });

    return { message: 'Interview email resent successfully' };
  }

  // ---------------------------------------------------------------------------
  // Applicant interview schedule & response methods
  // ---------------------------------------------------------------------------

  async getMyInterviewSchedules(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: apps, error: appsError } = await supabase
      .from('job_applications')
      .select('application_id, status, job_postings (title, job_posting_id)')
      .eq('applicant_id', applicantId);

    if (appsError) throw new InternalServerErrorException(appsError.message);
    if (!apps?.length) return [];

    const appIds = apps.map((a) => a.application_id);

    const { data: schedules, error: schedError } = await supabase
      .from('interview_schedules')
      .select('schedule_id, application_id, stage, scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes, created_at, applicant_response, applicant_response_note, applicant_responded_at')
      .in('application_id', appIds)
      .order('created_at', { ascending: false });

    if (schedError) throw new InternalServerErrorException(schedError.message);

    const appMap = new Map(apps.map((a) => [a.application_id, a]));

    return (schedules ?? []).map((s) => ({
      ...s,
      job_title:          (appMap.get(s.application_id) as any)?.job_postings?.title ?? '',
      application_status: (appMap.get(s.application_id) as any)?.status ?? '',
    }));
  }

  async respondToInterview(applicationId: string, applicantId: string, dto: InterviewResponseDto) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id, job_postings (title)')
      .eq('application_id', applicationId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    // If the applicant specifies a stage, update that stage's schedule.
    // Otherwise, update the most recent pending schedule (applicant_response IS NULL).
    const baseUpdate = supabase
      .from('interview_schedules')
      .update({
        applicant_response:      dto.action,
        applicant_response_note: dto.note ?? null,
        applicant_responded_at:  new Date().toISOString(),
      })
      .eq('application_id', applicationId);

    const { data: schedule, error: schedError } = await (
      dto.stage
        ? baseUpdate.eq('stage', dto.stage)
        : baseUpdate.is('applicant_response', null)
    )
      .select('scheduled_by_email, scheduled_date, scheduled_time, stage')
      .maybeSingle();

    if (schedError) throw new InternalServerErrorException(schedError.message);
    if (!schedule) throw new NotFoundException('No pending interview schedule found for this application');

    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email')
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (schedule.scheduled_by_email && profile?.email) {
      const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
      this.mailService.sendApplicantResponseEmail({
        to:             schedule.scheduled_by_email,
        applicantName,
        applicantEmail: profile.email,
        jobTitle:       (app.job_postings as any)?.title ?? 'the position',
        action:         dto.action,
        note:           dto.note,
        scheduledDate:  schedule.scheduled_date,
        scheduledTime:  schedule.scheduled_time,
      }).catch(() => {});
    }

    return { message: 'Response recorded' };
  }

  async getHRInterviewCalendar(companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('interview_schedules')
      .select(`
        schedule_id, application_id, scheduled_date, scheduled_time, duration_minutes,
        format, location, meeting_link, interviewer_name, interviewer_title,
        applicant_response, created_at,
        job_applications (
          status, applicant_id,
          job_postings (title, job_posting_id)
        )
      `)
      .eq('company_id', companyId)
      .order('scheduled_date', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);

    const applicantIds = [
      ...new Set(
        (data ?? [])
          .map((s) => (s.job_applications as any)?.applicant_id)
          .filter(Boolean),
      ),
    ];

    const { data: profiles } = applicantIds.length
      ? await supabase
          .from('applicant_profile')
          .select('applicant_id, first_name, last_name, email')
          .in('applicant_id', applicantIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.applicant_id, p]));

    return (data ?? []).map((s) => {
      const app     = s.job_applications as any;
      const profile = profileMap.get(app?.applicant_id);
      return {
        schedule_id:        s.schedule_id,
        application_id:     s.application_id,
        scheduled_date:     s.scheduled_date,
        scheduled_time:     s.scheduled_time,
        duration_minutes:   s.duration_minutes,
        format:             s.format,
        location:           s.location,
        meeting_link:       s.meeting_link,
        interviewer_name:   s.interviewer_name,
        interviewer_title:  s.interviewer_title,
        applicant_response: s.applicant_response,
        created_at:         s.created_at,
        application_status: app?.status,
        job_title:          app?.job_postings?.title ?? '',
        job_posting_id:     app?.job_postings?.job_posting_id ?? '',
        first_name:         profile?.first_name ?? '',
        last_name:          profile?.last_name  ?? '',
        email:              profile?.email       ?? '',
      };
    });
  }

  async getHRInterviewNotifications(companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('interview_schedules')
      .select(`
        schedule_id, application_id, scheduled_date, scheduled_time, format,
        interviewer_name, applicant_response, applicant_response_note, applicant_responded_at,
        job_applications (
          applicant_id,
          job_postings (title)
        )
      `)
      .eq('company_id', companyId)
      .not('applicant_response', 'is', null)
      .order('applicant_responded_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);

    const applicantIds = [
      ...new Set(
        (data ?? [])
          .map((s) => (s.job_applications as any)?.applicant_id)
          .filter(Boolean),
      ),
    ];

    const { data: profiles } = applicantIds.length
      ? await supabase
          .from('applicant_profile')
          .select('applicant_id, first_name, last_name, email')
          .in('applicant_id', applicantIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.applicant_id, p]));

    return (data ?? []).map((s) => {
      const app     = s.job_applications as any;
      const profile = profileMap.get(app?.applicant_id);
      return {
        schedule_id:             s.schedule_id,
        application_id:          s.application_id,
        scheduled_date:          s.scheduled_date,
        scheduled_time:          s.scheduled_time,
        format:                  s.format,
        interviewer_name:        s.interviewer_name,
        applicant_response:      s.applicant_response,
        applicant_response_note: s.applicant_response_note,
        applicant_responded_at:  s.applicant_responded_at,
        job_title:               app?.job_postings?.title ?? '',
        first_name:              profile?.first_name ?? '',
        last_name:               profile?.last_name  ?? '',
        email:                   profile?.email       ?? '',
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Public methods — no auth required
  // ---------------------------------------------------------------------------

  async getPublicCareersBySlug(slug: string) {
    const supabase = this.supabaseService.getClient();

    const { data: company } = await supabase
      .from('company')
      .select('company_id, company_name, slug')
      .eq('slug', slug)
      .maybeSingle();

    if (!company) throw new NotFoundException('Company not found');

    const { data: jobs } = await supabase
      .from('job_postings')
      .select('job_posting_id, title, description, location, employment_type, salary_range, posted_at, closes_at')
      .eq('company_id', company.company_id)
      .eq('status', 'open')
      .or('closes_at.is.null,closes_at.gt.' + new Date().toISOString())
      .order('posted_at', { ascending: false });

    return {
      company_id: company.company_id,
      company_name: company.company_name,
      slug: company.slug,
      jobs: jobs ?? [],
    };
  }

  // ---------------------------------------------------------------------------
  // Applicant-facing methods — scoped by companyId from applicant JWT
  // ---------------------------------------------------------------------------

  async getOpenJobsForApplicant(companyId: string | null) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('job_postings')
      .select('*')
      .eq('status', 'open')
      .or('closes_at.is.null,closes_at.gt.' + new Date().toISOString())
      .order('posted_at', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async applyToJob(jobPostingId: string, applicantId: string, companyId: string | null, dto: CreateApplicationDto) {
    if (!companyId) {
      throw new ForbiddenException(
        'Your account is not linked to a company. Please register via the company-specific link.',
      );
    }

    const supabase = this.supabaseService.getClient();

    const { data: job } = await supabase
      .from('job_postings')
      .select('job_posting_id, status')
      .eq('job_posting_id', jobPostingId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!job) throw new NotFoundException('Job posting not found');
    if (job.status !== 'open') throw new ForbiddenException('This job posting is no longer accepting applications');

    // Block hired/onboarding applicants from applying to new jobs
    const { data: applicantProfile } = await supabase
      .from('applicant_profile')
      .select('status, first_name, last_name, resume_url')
      .eq('applicant_id', applicantId)
      .maybeSingle();
    if (applicantProfile?.status === 'onboarding' || applicantProfile?.status === 'converted_employee') {
      throw new ForbiddenException('You have already been hired and cannot apply to new positions.');
    }

    const { data: existing } = await supabase
      .from('job_applications')
      .select('application_id')
      .eq('job_posting_id', jobPostingId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (existing) throw new ConflictException('You have already applied to this job');

    const application_id = crypto.randomUUID();
    const { data, error } = await supabase
      .from('job_applications')
      .insert({
        application_id,
        job_posting_id: jobPostingId,
        applicant_id: applicantId,
        status: 'submitted',
        applied_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // Save answers if provided
    if (dto.answers && dto.answers.length > 0) {
      const answerRows = dto.answers.map((a) => ({
        answer_id: crypto.randomUUID(),
        application_id,
        question_id: a.question_id,
        answer_value: a.answer_value ?? null,
      }));

      const { error: answerError } = await supabase.from('applicant_answers').insert(answerRows);
      if (answerError) {
        console.error('Failed to save applicant answers:', answerError.message);
      }
    }

    // Fire-and-forget: trigger Pillar CV parsing for this application if resume is available.
    // Parsed skills are stored in extracted_cv_skills linked to this job application.
    void this.triggerCvParsingForApplication(
      application_id,
      jobPostingId,
      applicantId,
      applicantProfile,
    );

    return data;
  }

  /**
   * Trigger Pillar CV parsing after an application is submitted.
   * Results are stored in extracted_cv_skills (per-application, per-job).
   * Failures are recorded on applicant_profile.cv_parsing_status.
   * This is fire-and-forget — never throws to the caller.
   */
  private async triggerCvParsingForApplication(
    applicationId: string,
    jobPostingId: string,
    applicantId: string,
    applicantProfile: { first_name?: string; last_name?: string; resume_url?: string } | null,
  ): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      const resumeUrl = applicantProfile?.resume_url ?? null;

      if (!resumeUrl) {
        // No CV uploaded yet — mark as pending, will be parsed when CV is uploaded
        await supabase
          .from('applicant_profile')
          .update({ cv_parsing_status: 'pending' })
          .eq('applicant_id', applicantId);
        return;
      }

      const applicantName = [applicantProfile?.first_name, applicantProfile?.last_name]
        .filter(Boolean)
        .join(' ') || 'Applicant';

      // If resume_url is a storage path (not a public URL) generate a signed URL for Pillar
      let cvUrl = resumeUrl;
      if (!resumeUrl.startsWith('https://')) {
        const { data: urlData } = await supabase.storage
          .from('applicant-resumes')
          .createSignedUrl(resumeUrl, 60 * 60);
        cvUrl = urlData?.signedUrl ?? resumeUrl;
      }

      // Fetch job SFIA demand skills to guide extraction
      const demandSkills = await this.getJobDemandSkills(jobPostingId);
      const jobSfiaSkills = demandSkills.map((s) => ({
        skill_name: s.skill_name,
        required_level: s.required_level,
      }));

      // Call Pillar
      const parseResult = await this.pillarService.parseCv(cvUrl, applicantName);

      if (!parseResult.success) {
        await supabase
          .from('applicant_profile')
          .update({
            cv_parsing_status: 'failed',
            cv_parsing_error_message: parseResult.error ?? 'Unknown error',
          })
          .eq('applicant_id', applicantId);
        this.logger.warn(`[CV Parsing] Failed for applicant ${applicantId}: ${parseResult.error}`);
        return;
      }

      // Extract SFIA skills from parsed CV
      const extractedSkills = await this.pillarService.extractSfiaSkills(parseResult, jobSfiaSkills);

      // Store each extracted skill in extracted_cv_skills
      if (extractedSkills.length > 0) {
        const skillRows = extractedSkills.map((skill) => ({
          extraction_id: crypto.randomUUID(),
          application_id: applicationId,
          applicant_id: applicantId,
          skill_name: skill.skill_name,
          candidate_level: skill.candidate_level,
          years_of_experience: skill.years_of_experience,
          extracted_from: skill.extracted_from,
          confidence_score: skill.confidence_score,
          pillar_parse_response: parseResult.data ?? null,
          extracted_at: new Date().toISOString(),
          extracted_by: 'pillar_service',
        }));

        const { error: skillsError } = await supabase
          .from('extracted_cv_skills')
          .insert(skillRows);

        if (skillsError) {
          this.logger.warn(`[CV Parsing] Failed to save extracted skills for application ${applicationId}: ${skillsError.message}`);
        }
      }

      // Update applicant profile with parsing completion status
      await supabase
        .from('applicant_profile')
        .update({
          cv_parsing_status: 'completed',
          resume_parsed_at: new Date().toISOString(),
          cv_parsing_error_message: null,
        })
        .eq('applicant_id', applicantId);

      this.logger.log(`[CV Parsing] Completed for applicant ${applicantId}, application ${applicationId}: ${extractedSkills.length} skills extracted`);
    } catch (err) {
      this.logger.error(`[CV Parsing] Unexpected error for application ${applicationId}: ${(err as Error).message}`);
      try {
        const supabase = this.supabaseService.getClient();
        await supabase
          .from('applicant_profile')
          .update({
            cv_parsing_status: 'failed',
            cv_parsing_error_message: (err as Error).message,
          })
          .eq('applicant_id', applicantId);
      } catch {
        // best-effort
      }
    }
  }

  async getMyApplicationDetail(applicationId: string, applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error } = await supabase
      .from('job_applications')
      .select(`
        application_id, status, applied_at, job_posting_id,
        applicant_profile (first_name, last_name, email, phone_number, applicant_code),
        job_postings (title, description, location, employment_type, salary_range, status, posted_at, closes_at)
      `)
      .eq('application_id', applicationId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!app) throw new NotFoundException('Application not found');

    const { data: answers } = await supabase
      .from('applicant_answers')
      .select(`
        answer_id, answer_value,
        application_questions (question_id, question_text, question_type, options, sort_order)
      `)
      .eq('application_id', applicationId)
      .order('application_questions(sort_order)');

    const { data: schedules } = await supabase
      .from('interview_schedules')
      .select('schedule_id, application_id, stage, scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes, created_at, updated_at, applicant_response, applicant_response_note, applicant_responded_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    // Build a per-stage map so the frontend can pick the right schedule
    const interview_schedules: Record<string, any> = {};
    for (const s of (schedules ?? [])) {
      const key = s.stage ?? 'first_interview';
      interview_schedules[key] = s;
    }
    const latestSchedule = (schedules ?? [])[0] ?? null;

    return { ...app, answers: answers ?? [], interview_schedule: latestSchedule, interview_schedules };
  }

  async getMyApplications(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        application_id,
        status,
        applied_at,
        job_posting_id,
        job_postings (
          title,
          location,
          employment_type,
          status
        )
      `)
      .eq('applicant_id', applicantId)
      .order('applied_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  private async buildRankedCandidates(
    jobPostingId: string,
    applications: RankedApplicationRow[],
    demandSkills: SfiaDemandSkill[],
    companyId: string,
  ): Promise<RankedCandidate[]> {
    const supplyRows = await this.getCandidateSupplySkills(applications);
    const applicantProfiles = await this.getApplicantProfiles(applications);
    const groupedSupply = supplyRows.reduce<Record<string, SfiaSupplySkill[]>>(
      (acc, row) => {
        acc[row.owner_key] ??= [];
        acc[row.owner_key].push(row);
        return acc;
      },
      {},
    );
    const profileByApplicantId = new Map(
      applicantProfiles.map((profile) => [profile.applicant_id, profile]),
    );

    const ranked = await Promise.all(applications.map(async (application) => {
      const profile = profileByApplicantId.get(application.applicant_id);
      const supplySkills = groupedSupply[application.application_id] ?? [];
      const score = await this.computeSfiaScore(demandSkills, supplySkills, companyId);

      // Keep cached SFIA percentage in sync for downstream reporting.
      void this.cacheSfiaScore(jobPostingId, application.application_id, score.relevancePercentage);

      return {
        application_id: application.application_id,
        applicant_id: application.applicant_id,
        first_name: profile?.first_name ?? '',
        last_name: profile?.last_name ?? '',
        email: profile?.email ?? '',
        phone_number: profile?.phone_number ?? null,
        applicant_code: profile?.applicant_code ?? null,
        status: application.status,
        applied_at: application.application_timestamp,
        sfia_match_percentage: score.relevancePercentage,
        sfia_rank: 0,
        manual_rank_position: normalizeNumber(application.manual_rank_position) || null,
        effective_rank: 0,
        skill_breakdown: score.breakdown,
      } satisfies RankedCandidate;
    }));

    return ranked.sort((a, b) => {
      if (b.sfia_match_percentage !== a.sfia_match_percentage) {
        return b.sfia_match_percentage - a.sfia_match_percentage;
      }
      return new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime();
    });
  }

  private sortCandidatesByMode(
    candidates: RankedCandidate[],
    mode: RankingMode,
  ): RankedCandidate[] {
    if (mode === 'sfia') {
      // SFIA automatic: sort by match percentage descending
      return [...candidates].sort((a, b) => b.sfia_match_percentage - a.sfia_match_percentage);
    }

    // Manual ranking fallback mode: use explicit manual rankings or SFIA as tiebreaker
    return [...candidates].sort((a, b) => {
      // Primary: honor explicit manual_rank_position if set
      const hasManualA = a.manual_rank_position !== null && a.manual_rank_position !== undefined;
      const hasManualB = b.manual_rank_position !== null && b.manual_rank_position !== undefined;

      if (hasManualA && hasManualB) {
        // Both have manual positions: sort by position
        return (a.manual_rank_position || 0) - (b.manual_rank_position || 0);
      }

      if (hasManualA) return -1; // A has manual position, rank higher
      if (hasManualB) return 1;  // B has manual position, rank higher

      // Fallback 1: No manual positions set, use SFIA match percentage
      if (a.sfia_match_percentage !== b.sfia_match_percentage) {
        return b.sfia_match_percentage - a.sfia_match_percentage;
      }

      // Fallback 2: Same SFIA score, use SFIA rank
      return a.sfia_rank - b.sfia_rank;
    });
  }

  private async computeSfiaScore(
    demandSkills: SfiaDemandSkill[],
    supplySkills: SfiaSupplySkill[],
    companyId: string,
  ) {
    // Fetch SFIA settings for this company
    const sfiaSettings = await this.adminService.getSfiaSettings(companyId);

    const skillById = new Map(
      supplySkills.map((skill) => [skill.skill_id, skill]),
    );

    const relevantDemand = demandSkills;

    const breakdown = relevantDemand.map((demandSkill) => {
      const supplySkill = skillById.get(demandSkill.skill_id);
      const supplyLevel = supplySkill?.candidate_level ?? 0;

      let points = 0;
      if (supplyLevel === demandSkill.required_level)
        points = sfiaSettings.exact_match_points; // Use configurable value
      else if (supplyLevel > demandSkill.required_level)
        points = sfiaSettings.above_demand_points; // Use configurable value

      return {
        sfia_skill_id: demandSkill.skill_id,
        skill_name: demandSkill.skill_name,
        demand_level: demandSkill.required_level,
        supply_level: supplyLevel,
        points,
        matched: points > 0,
      } satisfies SkillBreakdown;
    });

    const totalPoints = breakdown.reduce((sum, item) => sum + item.points, 0);
    const maxPossiblePoints = relevantDemand.length * sfiaSettings.exact_match_points;
    const relevancePercentage =
      maxPossiblePoints > 0
        ? roundToTwo((totalPoints / maxPossiblePoints) * 100)
        : 0;

    return {
      totalPoints,
      maxPossiblePoints,
      relevancePercentage,
      breakdown,
    };
  }

  private async getJobDemandSkills(jobPostingId: string): Promise<SfiaDemandSkill[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('job_posting_sfia_skill')
      .select('job_posting_skills_id, job_posting_id, skill_id, required_level, weight')
      .eq('job_posting_id', jobPostingId);

    if (error) {
      this.handleMissingSfiaSchema(error.message, 'job_posting_sfia_skill');
      throw new InternalServerErrorException(error.message);
    }

    const demandRows = (data ?? [])
      .map((row: Record<string, unknown>) => {
        const skillId = this.readFirstString(row, [
          'sfia_skill_id',
          'skill_id',
          'sfia_id',
        ]);
        if (!skillId) return null;

        return {
          skill_id: skillId,
          skill_name: skillId,
          required_level: normalizeNumber(
            this.readFirstValue(row, ['required_level', 'level']),
          ),
          weight: normalizeNumber(this.readFirstValue(row, ['weight'])),
        } satisfies SfiaDemandSkill;
      })
      .filter((row): row is SfiaDemandSkill => row !== null);

    return this.attachSkillNames(demandRows);
  }

  private async getCandidateSupplySkills(
    applications: RankedApplicationRow[],
  ): Promise<SfiaSupplySkill[]> {
    if (applications.length === 0) return [];

    const applicationIds = applications
      .map((row) => row.application_id)
      .filter((value): value is string => Boolean(value));

    if (applicationIds.length === 0) return [];

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('candidate_skill_score_sfia')
      .select('application_id, skill_id, candidate_level, match_score')
      .in('application_id', applicationIds);

    if (error) {
      this.handleMissingSfiaSchema(error.message, 'candidate_skill_score_sfia');
      throw new InternalServerErrorException(error.message);
    }

    const supplyRows = (data ?? [])
      .map((row: Record<string, unknown>) => {
        const ownerKey =
          this.readFirstString(row, ['applicant_id', 'application_id']) ?? '';
        const skillId = this.readFirstString(row, [
          'sfia_skill_id',
          'skill_id',
          'sfia_id',
        ]);
        if (!ownerKey || !skillId) return null;

        return {
          owner_key: ownerKey,
          skill_id: skillId,
          skill_name: skillId,
          candidate_level: normalizeNumber(
            this.readFirstValue(row, ['candidate_level', 'level']),
          ),
          match_score: this.readNullableNumber(row, ['match_score']),
        } satisfies SfiaSupplySkill;
      })
      .filter((row): row is SfiaSupplySkill => row !== null);

    return this.attachSkillNames(supplyRows);
  }

  private async cacheSfiaScore(
    jobPostingId: string,
    applicationId: string,
    sfiaMatchPercentage: number,
  ) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('job_application_sfia')
      .update({ sfia_matching_percentage: sfiaMatchPercentage })
      .eq('job_posting_id', jobPostingId)
      .eq('application_id', applicationId);

    if (error) {
      this.logger.warn(
        `Unable to cache sfia_match_percentage for application ${applicationId}: ${error.message}`,
      );
    }
  }

  private readFirstValue(
    row: Record<string, unknown>,
    keys: string[],
  ): unknown {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) return row[key];
    }
    return undefined;
  }

  private readFirstString(
    row: Record<string, unknown>,
    keys: string[],
  ): string | null {
    const value = this.readFirstValue(row, keys);
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  }

  private readNullableNumber(
    row: Record<string, unknown>,
    keys: string[],
  ): number | null {
    const value = this.readFirstValue(row, keys);
    if (value === undefined || value === null || value === '') return null;
    const parsed = normalizeNumber(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async getRankedApplicationRows(
    jobPostingId: string,
    companyId: string,
  ): Promise<RankedApplicationRow[]> {
    const supabase = this.supabaseService.getClient();

    await this.findOnePosting(jobPostingId, companyId);

    // Fetch SFIA-specific applications (have supply skill data)
    const { data: sfiaData, error: sfiaError } = await supabase
      .from('job_application_sfia')
      .select(
        'application_id, job_posting_id, applicant_id, status, application_timestamp, pre_screening_score, sfia_matching_percentage, manual_rank_position, ranking_mode',
      )
      .eq('job_posting_id', jobPostingId);

    if (sfiaError) {
      this.handleMissingSfiaSchema(sfiaError.message, 'job_application_sfia');
    }

    // Also include regular job_applications so all applicants appear in SFIA ranking
    const { data: regularData, error: regularError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id, status, applied_at')
      .eq('job_posting_id', jobPostingId);

    if (regularError) throw new InternalServerErrorException(regularError.message);

    const sfiaIds = new Set((sfiaData ?? []).map((r: any) => r.application_id));

    // Normalise regular applications into RankedApplicationRow shape
    const regularNormalized: RankedApplicationRow[] = (regularData ?? [])
      .filter((r: any) => !sfiaIds.has(r.application_id))
      .map((r: any) => ({
        application_id:        r.application_id,
        job_posting_id:        r.job_posting_id,
        applicant_id:          r.applicant_id,
        status:                r.status,
        application_timestamp: r.applied_at,
        pre_screening_score:   null,
        sfia_matching_percentage: null,
        manual_rank_position:  null,
        ranking_mode:          'sfia',
      }));

    return [...(sfiaData ?? []) as RankedApplicationRow[], ...regularNormalized];
  }

  private async getApplicantProfiles(
    applications: RankedApplicationRow[],
  ): Promise<ApplicantProfileRow[]> {
    const applicantIds = applications
      .map((row) => row.applicant_id)
      .filter((value): value is string => Boolean(value));

    if (applicantIds.length === 0) return [];

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('applicant_profile')
      .select('applicant_id, first_name, last_name, email, phone_number, applicant_code')
      .in('applicant_id', applicantIds);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return (data ?? []) as ApplicantProfileRow[];
  }

  private async attachSkillNames<T extends { skill_id: string; skill_name: string }>(
    rows: T[],
  ): Promise<T[]> {
    const skillIds = [...new Set(rows.map((row) => row.skill_id).filter(Boolean))];
    if (skillIds.length === 0) return rows;

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('sfia_skills')
      .select('*')
      .in(this.getSkillPrimaryKeyColumn(), skillIds);

    if (error) {
      this.handleMissingSfiaSchema(error.message, 'sfia_skills');
      return rows;
    }

    const nameById = new Map<string, string>();
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const id = this.readFirstString(row, ['skill_id', 'sfia_skill_id', 'id']);
      if (!id) continue;
      const name =
        this.readFirstString(row, ['skill_name', 'name']) ??
        this.readFirstString(row, ['skill']) ??
        id;
      nameById.set(id, name);
    }

    return rows.map((row) => ({
      ...row,
      skill_name: nameById.get(row.skill_id) ?? row.skill_name,
    }));
  }

  private getSkillPrimaryKeyColumn() {
    return 'skill_id';
  }

  private handleMissingSfiaSchema(message: string, tableName: string) {
    if (message.includes('schema cache')) {
      this.logger.error(
        `SFIA ranking requires the ${tableName} table, but it is not available in the configured Supabase project.`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Interview Evaluations — interviewers submit, HR Officers retrieve
  // ---------------------------------------------------------------------------

  async submitInterviewEvaluation(
    applicationId: string,
    companyId: string,
    evaluatorId: string,
    evaluatorRole: string,
    dto: {
      stage: string;
      evaluator_name?: string;
      technical_score?: number;
      communication_score?: number;
      culture_fit_score?: number;
      overall_score?: number;
      recommendation?: string;
      strengths?: string;
      areas_for_improvement?: string;
      additional_notes?: string;
      criteria_scores?: Record<string, unknown>;
    },
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    const evaluationId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('interview_evaluations')
      .insert({
        evaluation_id: evaluationId,
        application_id: applicationId,
        job_posting_id: app.job_posting_id,
        company_id: companyId,
        stage: dto.stage,
        evaluator_id: evaluatorId,
        evaluator_name: dto.evaluator_name ?? null,
        technical_score: dto.technical_score ?? null,
        communication_score: dto.communication_score ?? null,
        culture_fit_score: dto.culture_fit_score ?? null,
        overall_score: dto.overall_score ?? null,
        recommendation: dto.recommendation ?? null,
        strengths: dto.strengths ?? null,
        areas_for_improvement: dto.areas_for_improvement ?? null,
        additional_notes: dto.additional_notes ?? null,
        criteria_scores: dto.criteria_scores ?? null,
        submitted_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    await this.auditService.log(
      `Interview evaluation submitted for application ${applicationId}, stage: ${dto.stage}`,
      evaluatorId,
      companyId,
    );

    // Log timeline event
    void this.logTimelineEvent({
      applicationId,
      jobPostingId: app.job_posting_id,
      companyId,
      performedBy: evaluatorId,
      performerRole: evaluatorRole,
      eventType: 'stage_handoff',
      fromStatus: null,
      toStatus: dto.stage,
      notes: `Evaluation submitted. Recommendation: ${dto.recommendation ?? 'N/A'}`,
    });

    return data;
  }

  async getInterviewEvaluations(applicationId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    const { data, error } = await supabase
      .from('interview_evaluations')
      .select('*')
      .eq('application_id', applicationId)
      .order('submitted_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  // ---------------------------------------------------------------------------
  // Offer Management — HR drafts, sends, and tracks candidate response
  // ---------------------------------------------------------------------------

  async createOffer(
    applicationId: string,
    companyId: string,
    createdBy: string,
    dto: {
      position_title?: string;
      department?: string;
      start_date?: string;
      base_salary?: number;
      currency?: string;
      salary_frequency?: string;
      benefits_summary?: string;
      benefits_detail?: Record<string, unknown>;
      offer_letter_text?: string;
      expires_at?: string;
    },
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    const offerId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('job_offers')
      .insert({
        offer_id: offerId,
        application_id: applicationId,
        job_posting_id: app.job_posting_id,
        company_id: companyId,
        applicant_id: app.applicant_id,
        status: 'draft',
        position_title: dto.position_title ?? null,
        department: dto.department ?? null,
        start_date: dto.start_date ?? null,
        base_salary: dto.base_salary ?? null,
        currency: dto.currency ?? 'PHP',
        salary_frequency: dto.salary_frequency ?? 'monthly',
        benefits_summary: dto.benefits_summary ?? null,
        benefits_detail: dto.benefits_detail ?? null,
        offer_letter_text: dto.offer_letter_text ?? null,
        created_by: createdBy,
        expires_at: dto.expires_at ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    await this.auditService.log(
      `Offer draft created for application ${applicationId}`,
      createdBy,
      companyId,
    );

    return data;
  }

  async sendOffer(offerId: string, companyId: string, sentBy: string) {
    const supabase = this.supabaseService.getClient();

    const { data: offer, error: offerError } = await supabase
      .from('job_offers')
      .select('*')
      .eq('offer_id', offerId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (offerError) throw new InternalServerErrorException(offerError.message);
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== 'draft') throw new BadRequestException('Only draft offers can be sent');

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('job_offers')
      .update({ status: 'sent', sent_at: now, sent_by: sentBy, updated_at: now })
      .eq('offer_id', offerId);

    if (updateError) throw new InternalServerErrorException(updateError.message);

    // Fetch applicant email to send offer
    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email, company_id')
      .eq('applicant_id', offer.applicant_id)
      .maybeSingle();

    if (profile?.email) {
      const applicantName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Applicant';
      this.mailService.sendOfferEmail({
        to: profile.email,
        applicantName,
        positionTitle: offer.position_title ?? 'the position',
        department: offer.department,
        startDate: offer.start_date,
        baseSalary: offer.base_salary,
        currency: offer.currency ?? 'PHP',
        salaryFrequency: offer.salary_frequency ?? 'monthly',
        benefitsSummary: offer.benefits_summary,
        offerLetterText: offer.offer_letter_text,
        expiresAt: offer.expires_at,
      }).catch(() => {});
    }

    // Update application status to offer_sent
    await supabase
      .from('job_applications')
      .update({ status: 'offer_sent' })
      .eq('application_id', offer.application_id);

    // Log timeline event
    void this.logTimelineEvent({
      applicationId: offer.application_id,
      jobPostingId: offer.job_posting_id,
      companyId,
      performedBy: sentBy,
      performerRole: 'HR Officer',
      eventType: 'offer_sent',
      fromStatus: 'shortlisted',
      toStatus: 'offer_sent',
    });

    await this.auditService.log(
      `Offer sent for application ${offer.application_id}`,
      sentBy,
      companyId,
    );

    return { message: 'Offer sent successfully', offer_id: offerId };
  }

  async getOffersForApplication(applicationId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    const { data, error } = await supabase
      .from('job_offers')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async getRecruitmentTimeline(applicationId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);
    if (!app) throw new NotFoundException('Application not found');

    await this.findOnePosting(app.job_posting_id, companyId);

    const { data, error } = await supabase
      .from('recruitment_timeline_events')
      .select('*')
      .eq('application_id', applicationId)
      .order('occurred_at', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}