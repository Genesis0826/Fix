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
import { NotificationsService } from '../notifications/notifications.service';
import { PillarService } from '../pillar/pillar.service';
import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { UpdateJobPostingDto } from './dto/update-job-posting.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationQuestionDto } from './dto/create-questions.dto';
import { GetRankedCandidatesDto } from './dto/get-ranked-candidates.dto';
import { ManualRankingItemDto } from './dto/save-manual-ranking.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { InterviewResponseDto } from './dto/interview-response.dto';
import {
  CreateInterviewEvaluationDto,
  UpdateInterviewEvaluationDto,
} from './dto/interview-evaluation.dto';
import { CreateOfferDto, RespondToOfferDto } from './dto/offer.dto';
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
    private readonly notificationsService: NotificationsService,
    private readonly pillarService: PillarService,
    private readonly onboardingService: OnboardingService,
    private readonly adminService: AdminService,
  ) {}

  // ---------------------------------------------------------------------------
  // HR-facing methods — all scoped by companyId from JWT
  // ---------------------------------------------------------------------------

  async createPosting(
    dto: CreateJobPostingDto,
    companyId: string,
    performedBy: string,
  ) {
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
      applicant_count:
        (row.job_applications as { count: number }[])?.[0]?.count ?? 0,
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

  async updatePosting(
    jobPostingId: string,
    dto: UpdateJobPostingDto,
    companyId: string,
    performedBy: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const existing = await this.findOnePosting(jobPostingId, companyId);

    const updateFields: Record<string, any> = {};
    if (dto.title !== undefined) updateFields.title = dto.title;
    if (dto.description !== undefined)
      updateFields.description = dto.description;
    if (dto.location !== undefined) updateFields.location = dto.location;
    if (dto.employment_type !== undefined)
      updateFields.employment_type = dto.employment_type;
    if (dto.salary_range !== undefined)
      updateFields.salary_range = dto.salary_range;
    if (dto.department_id !== undefined)
      updateFields.department_id = dto.department_id;
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
    const statusChange =
      dto.status && dto.status !== existing.status
        ? ` (status: ${existing.status} → ${dto.status})`
        : '';
    await this.auditService.log(
      `Job posting updated: "${existing.title}" - fields: ${changedFields.join(', ')}${statusChange}`,
      performedBy,
      companyId,
    );

    return data;
  }

  async closePosting(
    jobPostingId: string,
    companyId: string,
    performedBy: string,
  ) {
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

  async setQuestionsForPosting(
    jobPostingId: string,
    questions: ApplicationQuestionDto[],
    companyId: string,
    performedBy: string,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify job ownership
    const existing = await this.findOnePosting(jobPostingId, companyId);

    // Replace all existing questions
    await supabase
      .from('application_questions')
      .delete()
      .eq('job_posting_id', jobPostingId);

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
      .select(
        'question_id, question_text, question_type, options, is_required, sort_order',
      )
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
      .select(
        `
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
      `,
      )
      .eq('job_posting_id', jobPostingId)
      .order('applied_at', { ascending: false });

    if (regularError)
      throw new InternalServerErrorException(regularError.message);

    const { data: sfiaApps, error: sfiaError } = await supabase
      .from('job_application_sfia')
      .select('application_id, status, application_timestamp, applicant_id')
      .eq('job_posting_id', jobPostingId)
      .order('application_timestamp', { ascending: false });

    if (sfiaError) {
      this.logger.warn(
        `Unable to fetch SFIA applications for job ${jobPostingId}: ${sfiaError.message}`,
      );
    }

    const regularIds = new Set(
      (regularApps ?? []).map(
        (a: { application_id: string }) => a.application_id,
      ),
    );

    const uniqueSfiaApps = (sfiaApps ?? []).filter(
      (a: { application_id: string }) => !regularIds.has(a.application_id),
    );

    let sfiaProfiles: ApplicantProfileRow[] = [];
    if (uniqueSfiaApps.length > 0) {
      const applicantIds = uniqueSfiaApps.map(
        (a: { applicant_id: string }) => a.applicant_id,
      );
      const { data: profiles } = await supabase
        .from('applicant_profile')
        .select(
          'applicant_id, first_name, last_name, email, phone_number, applicant_code',
        )
        .in('applicant_id', applicantIds);
      sfiaProfiles = (profiles ?? []) as ApplicantProfileRow[];
    }

    const profileMap = new Map(sfiaProfiles.map((p) => [p.applicant_id, p]));

    const normalizedSfiaApps = uniqueSfiaApps.map(
      (a: {
        application_id: string;
        status: string;
        application_timestamp: string;
        applicant_id: string;
      }) => ({
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
      (a, b) =>
        new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime(),
    );
  }

  async getRankedCandidates(
    jobPostingId: string,
    companyId: string,
    query: GetRankedCandidatesDto,
  ) {
    const requestedMode: RankingMode = query.mode ?? 'sfia';
    const limit = query.limit ?? 20;

    const job = await this.findOnePosting(jobPostingId, companyId);
    const applications = await this.getRankedApplicationRows(
      jobPostingId,
      companyId,
    );
    const demandSkills = await this.getJobDemandSkills(jobPostingId);

    // Check if SFIA is enabled and healthy
    const sfiaSettings = await this.adminService.getSfiaSettings(companyId);
    let actualMode: RankingMode = requestedMode;
    let fallbackReason: string | null = null;

    // If SFIA was requested but disabled or failed health checks, auto-fallback to manual
    if (requestedMode === 'sfia') {
      if (!sfiaSettings.sfia_enabled) {
        actualMode = 'manual';
        fallbackReason =
          'SFIA disabled by administrator or auto-disabled due to system failures';
        this.logger.warn(
          `⚠️ SFIA ranking disabled for job ${jobPostingId}. Falling back to manual ranking.`,
        );
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
      (c) =>
        c.sfia_match_percentage < sfiaSettings.failover_threshold_percentage,
    );

    if (
      requestedMode === 'sfia' &&
      belowThreshold.length > 0 &&
      !fallbackReason
    ) {
      this.logger.warn(
        `⚠️ ${belowThreshold.length} candidates below SFIA threshold (${sfiaSettings.failover_threshold_percentage}%) for job ${jobPostingId}`,
      );
    }

    const sfiaRanked = ranked.map((candidate, index) => ({
      ...candidate,
      sfia_rank: index + 1,
    }));

    // Apply ranking mode (SFIA auto or manual fallback)
    const manuallyRanked = this.sortCandidatesByMode(
      sfiaRanked,
      actualMode,
    ).map((candidate, index) => ({
      ...candidate,
      effective_rank: index + 1,
    }));

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
      (applications ?? []).map(
        (row: { application_id: string }) => row.application_id,
      ),
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
        throw new BadRequestException(
          'Duplicate application_id in manual ranking payload',
        );
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
      (applications ?? []).map(
        (row: {
          application_id: string;
          manual_rank_position: number | null;
        }) => [row.application_id, row.manual_rank_position],
      ),
    );

    const historyRows = rankings.map((item) => ({
      history_id: crypto.randomUUID(),
      application_id: item.application_id,
      performed_by: performedBy,
      previous_rank: previousRankMap.get(item.application_id) ?? null,
      new_rank: item.rank,
      changed_at: new Date().toISOString(),
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
      .select(
        `
        application_id, status, applied_at, job_posting_id,
        applicant_profile (first_name, last_name, email, phone_number, applicant_code, resume_url, resume_name, resume_uploaded_at)
      `,
      )
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!app) throw new NotFoundException('Application not found');

    // Verify job belongs to this company
    await this.findOnePosting(app.job_posting_id, companyId);

    // Get answers joined with question info
    const { data: answers } = await supabase
      .from('applicant_answers')
      .select(
        `
        answer_id, answer_value,
        application_questions (question_id, question_text, question_type, options, sort_order)
      `,
      )
      .eq('application_id', applicationId)
      .order('application_questions(sort_order)');

    // Get all interview schedules for this application, keyed by stage
    const { data: schedules } = await supabase
      .from('interview_schedules')
      .select(
        'application_id, stage, scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes, created_at, applicant_response, applicant_response_note, applicant_responded_at',
      )
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    // Build a map: stage → schedule. Also expose the latest as interview_schedule for backwards compat.
    const interview_schedules: Record<string, any> = {};
    for (const s of schedules ?? []) {
      const key = s.stage ?? 'first_interview';
      interview_schedules[key] = s;
    }
    const latestSchedule = (schedules ?? [])[0] ?? null;

    // Generate a signed URL for the resume if it's stored as a file path
    const profile = (app as any).applicant_profile as Record<
      string,
      any
    > | null;
    if (profile?.resume_url && !profile.resume_url.startsWith('https://')) {
      const { data: urlData } = await supabase.storage
        .from('applicant-resumes')
        .createSignedUrl(profile.resume_url, 60 * 60 * 24 * 7);
      if (urlData?.signedUrl) {
        (app as any).applicant_profile = {
          ...profile,
          resume_url: urlData.signedUrl,
        };
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
  async updateApplicationStatus(
    applicationId: string,
    status: string,
    companyId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (appError) throw new InternalServerErrorException(appError.message);

    if (app) {
      await this.findOnePosting(app.job_posting_id, companyId);
      await this.validateAndUpdateRegularApplication(
        app,
        status,
        companyId,
        applicationId,
        supabase,
      );
      return { message: 'Application status updated' };
    }

    // Fall back to SFIA applications table
    await this.validateAndUpdateSfiaApplication(
      applicationId,
      status,
      companyId,
      supabase,
    );
    return { message: 'Application status updated' };
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
      await this.enforceOneHirePerCompanyConstraint(
        app.applicant_id,
        companyId,
        applicationId,
        supabase,
      );
    }

    const { error } = await supabase
      .from('job_applications')
      .update({ status })
      .eq('application_id', applicationId);

    if (error) throw new InternalServerErrorException(error.message);

    if (isHired) {
      await this.handleHiredApplicationOnboarding(app, companyId);
    }

    // Send applicant notifications for key status changes
    this.sendApplicantStatusNotification(
      app.applicant_id,
      applicationId,
      companyId,
      status,
    ).catch(() => {});

    // Log timeline event
    this.logTimelineEvent({
      applicationId,
      companyId,
      eventType: status,
      toStage: status,
    }).catch(() => {});
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
      applicantId: app.applicant_id,
      jobPostingId: app.job_posting_id,
      companyId,
    });
    await this.onboardingService.createApplicantSession({
      applicantId: app.applicant_id,
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

    if (sfiaAppError)
      throw new InternalServerErrorException(sfiaAppError.message);
    if (!sfiaApp) throw new NotFoundException('Application not found');

    await this.findOnePosting(sfiaApp.job_posting_id, companyId);

    const { error: sfiaUpdateError } = await supabase
      .from('job_application_sfia')
      .update({ status: status.toUpperCase() })
      .eq('application_id', applicationId);

    if (sfiaUpdateError)
      throw new InternalServerErrorException(sfiaUpdateError.message);

    // Mirror the regular-application hired flow: create onboarding records for SFIA hires
    if (status === 'hired' && sfiaApp.applicant_id) {
      await this.handleSfiaHiredApplicationOnboarding(sfiaApp, companyId);
    }
  }

  private async handleSfiaHiredApplicationOnboarding(
    sfiaApp: any,
    companyId: string,
  ) {
    try {
      await this.onboardingService.createOnboardingRecord({
        applicationId: sfiaApp.application_id,
        applicantId: sfiaApp.applicant_id,
        jobPostingId: sfiaApp.job_posting_id,
        companyId,
      });
      await this.onboardingService.createApplicantSession({
        applicantId: sfiaApp.applicant_id,
        jobPostingId: sfiaApp.job_posting_id,
        companyId,
      });
      const supabase = this.supabaseService.getClient();
      await supabase
        .from('applicant_profile')
        .update({ status: 'onboarding' })
        .eq('applicant_id', sfiaApp.applicant_id);
    } catch (err) {
      this.logger.error(
        `[updateApplicationStatus] Failed to create onboarding for SFIA hire: ${(err as Error).message}`,
      );
    }
  }

  async scheduleInterview(
    applicationId: string,
    dto: ScheduleInterviewDto,
    companyId: string,
  ) {
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
      .upsert(
        {
          schedule_id: scheduleId,
          application_id: applicationId,
          company_id: companyId,
          stage,
          scheduled_date: dto.scheduled_date,
          scheduled_time: dto.scheduled_time,
          duration_minutes: dto.duration_minutes,
          format: dto.format,
          location: dto.location ?? null,
          meeting_link: dto.meeting_link ?? null,
          interviewer_name: dto.interviewer_name,
          interviewer_title: dto.interviewer_title ?? null,
          notes: dto.notes ?? null,
          scheduled_by_email: dto.scheduled_by_email ?? null,
          // Reset applicant response on reschedule
          applicant_response: null,
          applicant_response_note: null,
          applicant_responded_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'application_id,stage' },
      );

    if (insertError)
      throw new InternalServerErrorException(insertError.message);

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
      const applicantName =
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        'Applicant';
      const stageLabelMap: Record<string, string> = {
        first_interview: '1st Interview',
        technical_interview: 'Technical Interview',
        final_interview: 'Final Interview',
      };
      await this.mailService.sendInterviewScheduleEmail({
        to: profile.email,
        applicantName,
        jobTitle: posting?.title ?? 'the position',
        stageLabel: stageLabelMap[stage] ?? stage,
        isReschedule,
        scheduledDate: dto.scheduled_date,
        scheduledTime: dto.scheduled_time,
        durationMinutes: dto.duration_minutes,
        format: dto.format,
        location: dto.location,
        meetingLink: dto.meeting_link,
        interviewerName: dto.interviewer_name,
        interviewerTitle: dto.interviewer_title,
        notes: dto.notes,
      });
    }

    await this.auditService.log(
      `Interview scheduled for application ${applicationId} on ${dto.scheduled_date} at ${dto.scheduled_time}`,
      'system',
      companyId,
    );

    return {
      message: 'Interview scheduled and email sent',
      schedule_id: scheduleId,
    };
  }

  async cancelInterviewSchedule(
    applicationId: string,
    stage: string,
    companyId: string,
    reason?: string,
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

    if (deleteError)
      throw new InternalServerErrorException(deleteError.message);

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
      first_interview: '1st Interview',
      technical_interview: 'Technical Interview',
      final_interview: 'Final Interview',
    };

    if (profile?.email) {
      const applicantName =
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        'Applicant';
      await this.mailService.sendInterviewCancellationEmail({
        to: profile.email,
        applicantName,
        jobTitle: posting?.title ?? 'the position',
        scheduledDate: schedule.scheduled_date,
        scheduledTime: schedule.scheduled_time,
        stageLabel: stageLabelMap[stage] ?? stage,
        reason: reason ?? null,
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
      .select(
        'scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes',
      )
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (schedError) throw new InternalServerErrorException(schedError.message);
    if (!schedule)
      throw new NotFoundException(
        'No interview schedule found for this application',
      );

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

    if (!profile?.email)
      throw new NotFoundException('Applicant email not found');

    const applicantName =
      [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
      'Applicant';
    await this.mailService.sendInterviewScheduleEmail({
      to: profile.email,
      applicantName,
      jobTitle: posting?.title ?? 'the position',
      scheduledDate: schedule.scheduled_date,
      scheduledTime: schedule.scheduled_time,
      durationMinutes: schedule.duration_minutes,
      format: schedule.format,
      location: schedule.location,
      meetingLink: schedule.meeting_link,
      interviewerName: schedule.interviewer_name,
      interviewerTitle: schedule.interviewer_title,
      notes: schedule.notes,
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
      .select(
        'schedule_id, application_id, stage, scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes, created_at, applicant_response, applicant_response_note, applicant_responded_at',
      )
      .in('application_id', appIds)
      .order('created_at', { ascending: false });

    if (schedError) throw new InternalServerErrorException(schedError.message);

    const appMap = new Map(apps.map((a) => [a.application_id, a]));

    return (schedules ?? []).map((s) => ({
      ...s,
      job_title:
        (appMap.get(s.application_id) as any)?.job_postings?.title ?? '',
      application_status: (appMap.get(s.application_id) as any)?.status ?? '',
    }));
  }

  async respondToInterview(
    applicationId: string,
    applicantId: string,
    dto: InterviewResponseDto,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select(
        'application_id, job_posting_id, applicant_id, job_postings (title)',
      )
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
        applicant_response: dto.action,
        applicant_response_note: dto.note ?? null,
        applicant_responded_at: new Date().toISOString(),
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
    if (!schedule)
      throw new NotFoundException(
        'No pending interview schedule found for this application',
      );

    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email')
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (schedule.scheduled_by_email && profile?.email) {
      const applicantName =
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        'Applicant';
      this.mailService
        .sendApplicantResponseEmail({
          to: schedule.scheduled_by_email,
          applicantName,
          applicantEmail: profile.email,
          jobTitle: (app.job_postings as any)?.title ?? 'the position',
          action: dto.action,
          note: dto.note,
          scheduledDate: schedule.scheduled_date,
          scheduledTime: schedule.scheduled_time,
        })
        .catch(() => {});
    }

    return { message: 'Response recorded' };
  }

  async getHRInterviewCalendar(companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('interview_schedules')
      .select(
        `
        schedule_id, application_id, scheduled_date, scheduled_time, duration_minutes,
        format, location, meeting_link, interviewer_name, interviewer_title,
        applicant_response, created_at,
        job_applications (
          status, applicant_id,
          job_postings (title, job_posting_id)
        )
      `,
      )
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

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.applicant_id, p]),
    );

    return (data ?? []).map((s) => {
      const app = s.job_applications as any;
      const profile = profileMap.get(app?.applicant_id);
      return {
        schedule_id: s.schedule_id,
        application_id: s.application_id,
        scheduled_date: s.scheduled_date,
        scheduled_time: s.scheduled_time,
        duration_minutes: s.duration_minutes,
        format: s.format,
        location: s.location,
        meeting_link: s.meeting_link,
        interviewer_name: s.interviewer_name,
        interviewer_title: s.interviewer_title,
        applicant_response: s.applicant_response,
        created_at: s.created_at,
        application_status: app?.status,
        job_title: app?.job_postings?.title ?? '',
        job_posting_id: app?.job_postings?.job_posting_id ?? '',
        first_name: profile?.first_name ?? '',
        last_name: profile?.last_name ?? '',
        email: profile?.email ?? '',
      };
    });
  }

  async getHRInterviewNotifications(companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('interview_schedules')
      .select(
        `
        schedule_id, application_id, scheduled_date, scheduled_time, format,
        interviewer_name, applicant_response, applicant_response_note, applicant_responded_at,
        job_applications (
          applicant_id,
          job_postings (title)
        )
      `,
      )
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

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.applicant_id, p]),
    );

    return (data ?? []).map((s) => {
      const app = s.job_applications as any;
      const profile = profileMap.get(app?.applicant_id);
      return {
        schedule_id: s.schedule_id,
        application_id: s.application_id,
        scheduled_date: s.scheduled_date,
        scheduled_time: s.scheduled_time,
        format: s.format,
        interviewer_name: s.interviewer_name,
        applicant_response: s.applicant_response,
        applicant_response_note: s.applicant_response_note,
        applicant_responded_at: s.applicant_responded_at,
        job_title: app?.job_postings?.title ?? '',
        first_name: profile?.first_name ?? '',
        last_name: profile?.last_name ?? '',
        email: profile?.email ?? '',
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
      .select(
        'job_posting_id, title, description, location, employment_type, salary_range, posted_at, closes_at',
      )
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

  async applyToJob(
    jobPostingId: string,
    applicantId: string,
    companyId: string | null,
    dto: CreateApplicationDto,
  ) {
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
    if (job.status !== 'open')
      throw new ForbiddenException(
        'This job posting is no longer accepting applications',
      );

    // Block hired/onboarding applicants from applying to new jobs
    const { data: applicantProfile } = await supabase
      .from('applicant_profile')
      .select('status')
      .eq('applicant_id', applicantId)
      .maybeSingle();
    if (
      applicantProfile?.status === 'onboarding' ||
      applicantProfile?.status === 'converted_employee'
    ) {
      throw new ForbiddenException(
        'You have already been hired and cannot apply to new positions.',
      );
    }

    const { data: existing } = await supabase
      .from('job_applications')
      .select('application_id')
      .eq('job_posting_id', jobPostingId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (existing)
      throw new ConflictException('You have already applied to this job');

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

      const { error: answerError } = await supabase
        .from('applicant_answers')
        .insert(answerRows);
      if (answerError) {
        console.error('Failed to save applicant answers:', answerError.message);
      }
    }

    // Trigger async CV parsing via Pillar (fire-and-forget; does not block response)
    this.triggerCvParsingForApplication(
      application_id,
      applicantId,
      jobPostingId,
    ).catch((err) => {
      this.logger.error(
        `Background CV parsing error for application ${application_id}: ${err?.message}`,
      );
    });

    // Log submission timeline event (fire-and-forget)
    this.logTimelineEvent({
      applicationId: application_id,
      companyId: companyId,
      eventType: 'application_submitted',
      toStage: 'submitted',
      performedBy: applicantId,
      performedByRole: 'Applicant',
    }).catch(() => {});

    return data;
  }

  private async triggerCvParsingForApplication(
    applicationId: string,
    applicantId: string,
    jobPostingId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    try {
      // Fetch applicant profile to get resume_url
      const { data: profile } = await supabase
        .from('applicant_profile')
        .select('resume_url, first_name, last_name, cv_parsing_status')
        .eq('applicant_id', applicantId)
        .maybeSingle();

      if (!profile?.resume_url) return; // No CV uploaded, skip parsing

      // Mark as pending (idempotent if already set)
      await supabase
        .from('applicant_profile')
        .update({ cv_parsing_status: 'pending' })
        .eq('applicant_id', applicantId);

      const applicantName =
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        'Applicant';

      // Get job SFIA skills for targeted extraction
      const demandSkills = await this.getJobDemandSkills(jobPostingId);

      // Generate signed URL for Pillar parsing (valid 1 hour)
      let parseUrl = profile.resume_url;
      if (!parseUrl.startsWith('https://')) {
        const { data: urlData } = await supabase.storage
          .from('applicant-resumes')
          .createSignedUrl(profile.resume_url, 3600);
        parseUrl = urlData?.signedUrl ?? profile.resume_url;
      }

      // Parse the CV via Pillar
      const parseResult = await this.pillarService.parseCv(
        parseUrl,
        applicantName,
      );

      if (!parseResult.success) {
        await supabase
          .from('applicant_profile')
          .update({
            cv_parsing_status: 'failed',
            cv_parsing_error_message:
              parseResult.error ?? 'Pillar parsing failed',
            resume_parsed_at: new Date().toISOString(),
          })
          .eq('applicant_id', applicantId);
        return;
      }

      // Extract SFIA skills
      const sfiaSkills = await this.pillarService.extractSfiaSkills(
        parseResult,
        demandSkills,
      );

      // Persist extracted skills (upsert per application to avoid duplicates on re-parse)
      if (sfiaSkills.length > 0) {
        // Delete existing entries for this application before reinserting
        await supabase
          .from('extracted_cv_skills')
          .delete()
          .eq('application_id', applicationId)
          .eq('applicant_id', applicantId);

        const skillRows = sfiaSkills.map((skill) => ({
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

        await supabase.from('extracted_cv_skills').insert(skillRows);
      }

      // Mark parsing complete
      await supabase
        .from('applicant_profile')
        .update({
          cv_parsing_status: 'completed',
          cv_parsing_error_message: null,
          resume_parsed_at: new Date().toISOString(),
        })
        .eq('applicant_id', applicantId);

      this.logger.log(
        `CV parsing completed for applicant ${applicantId}, application ${applicationId}: ${sfiaSkills.length} SFIA skill(s) extracted`,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `CV parsing failed for applicant ${applicantId}, application ${applicationId}: ${errorMsg}`,
      );
      // Mark failed but do not block the application flow
      await supabase
        .from('applicant_profile')
        .update({
          cv_parsing_status: 'failed',
          cv_parsing_error_message: errorMsg,
          resume_parsed_at: new Date().toISOString(),
        })
        .eq('applicant_id', applicantId)
        .then(() => {});
    }
  }

  async getMyApplicationDetail(applicationId: string, applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app, error } = await supabase
      .from('job_applications')
      .select(
        `
        application_id, status, applied_at, job_posting_id,
        applicant_profile (first_name, last_name, email, phone_number, applicant_code),
        job_postings (title, description, location, employment_type, salary_range, status, posted_at, closes_at)
      `,
      )
      .eq('application_id', applicationId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!app) throw new NotFoundException('Application not found');

    const { data: answers } = await supabase
      .from('applicant_answers')
      .select(
        `
        answer_id, answer_value,
        application_questions (question_id, question_text, question_type, options, sort_order)
      `,
      )
      .eq('application_id', applicationId)
      .order('application_questions(sort_order)');

    const { data: schedules } = await supabase
      .from('interview_schedules')
      .select(
        'schedule_id, application_id, stage, scheduled_date, scheduled_time, duration_minutes, format, location, meeting_link, interviewer_name, interviewer_title, notes, created_at, updated_at, applicant_response, applicant_response_note, applicant_responded_at',
      )
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    // Build a per-stage map so the frontend can pick the right schedule
    const interview_schedules: Record<string, any> = {};
    for (const s of schedules ?? []) {
      const key = s.stage ?? 'first_interview';
      interview_schedules[key] = s;
    }
    const latestSchedule = (schedules ?? [])[0] ?? null;

    return {
      ...app,
      answers: answers ?? [],
      interview_schedule: latestSchedule,
      interview_schedules,
    };
  }

  async getMyApplications(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('job_applications')
      .select(
        `
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
      `,
      )
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

    const ranked = await Promise.all(
      applications.map(async (application) => {
        const profile = profileByApplicantId.get(application.applicant_id);
        const supplySkills = groupedSupply[application.application_id] ?? [];
        const score = await this.computeSfiaScore(
          demandSkills,
          supplySkills,
          companyId,
        );

        // Keep cached SFIA percentage in sync for downstream reporting.
        void this.cacheSfiaScore(
          jobPostingId,
          application.application_id,
          score.relevancePercentage,
        );

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
          manual_rank_position:
            normalizeNumber(application.manual_rank_position) || null,
          effective_rank: 0,
          skill_breakdown: score.breakdown,
        } satisfies RankedCandidate;
      }),
    );

    return ranked.sort((a, b) => {
      if (b.sfia_match_percentage !== a.sfia_match_percentage) {
        return b.sfia_match_percentage - a.sfia_match_percentage;
      }
      return (
        new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime()
      );
    });
  }

  private sortCandidatesByMode(
    candidates: RankedCandidate[],
    mode: RankingMode,
  ): RankedCandidate[] {
    if (mode === 'sfia') {
      // SFIA automatic: sort by match percentage descending
      return [...candidates].sort(
        (a, b) => b.sfia_match_percentage - a.sfia_match_percentage,
      );
    }

    // Manual ranking fallback mode: use explicit manual rankings or SFIA as tiebreaker
    return [...candidates].sort((a, b) => {
      // Primary: honor explicit manual_rank_position if set
      const hasManualA =
        a.manual_rank_position !== null && a.manual_rank_position !== undefined;
      const hasManualB =
        b.manual_rank_position !== null && b.manual_rank_position !== undefined;

      if (hasManualA && hasManualB) {
        // Both have manual positions: sort by position
        return (a.manual_rank_position || 0) - (b.manual_rank_position || 0);
      }

      if (hasManualA) return -1; // A has manual position, rank higher
      if (hasManualB) return 1; // B has manual position, rank higher

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
    const maxPossiblePoints =
      relevantDemand.length * sfiaSettings.exact_match_points;
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

  private async getJobDemandSkills(
    jobPostingId: string,
  ): Promise<SfiaDemandSkill[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('job_posting_sfia_skill')
      .select(
        'job_posting_skills_id, job_posting_id, skill_id, required_level, weight',
      )
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
      .select(
        'application_id, job_posting_id, applicant_id, status, applied_at',
      )
      .eq('job_posting_id', jobPostingId);

    if (regularError)
      throw new InternalServerErrorException(regularError.message);

    const sfiaIds = new Set((sfiaData ?? []).map((r: any) => r.application_id));

    // Normalise regular applications into RankedApplicationRow shape
    const regularNormalized: RankedApplicationRow[] = (regularData ?? [])
      .filter((r: any) => !sfiaIds.has(r.application_id))
      .map((r: any) => ({
        application_id: r.application_id,
        job_posting_id: r.job_posting_id,
        applicant_id: r.applicant_id,
        status: r.status,
        application_timestamp: r.applied_at,
        pre_screening_score: null,
        sfia_matching_percentage: null,
        manual_rank_position: null,
        ranking_mode: 'sfia',
      }));

    return [
      ...((sfiaData ?? []) as RankedApplicationRow[]),
      ...regularNormalized,
    ];
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
      .select(
        'applicant_id, first_name, last_name, email, phone_number, applicant_code',
      )
      .in('applicant_id', applicantIds);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return (data ?? []) as ApplicantProfileRow[];
  }

  private async attachSkillNames<
    T extends { skill_id: string; skill_name: string },
  >(rows: T[]): Promise<T[]> {
    const skillIds = [
      ...new Set(rows.map((row) => row.skill_id).filter(Boolean)),
    ];
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
  // Applicant status notifications
  // ---------------------------------------------------------------------------

  private async sendApplicantStatusNotification(
    applicantId: string,
    applicationId: string,
    companyId: string,
    status: string,
  ) {
    const NOTIFY_STATUSES = ['shortlisted', 'on_hold', 'rejected', 'hired'];
    if (!NOTIFY_STATUSES.includes(status)) return;

    const supabase = this.supabaseService.getClient();

    const [profileResult, appResult] = await Promise.all([
      supabase
        .from('applicant_profile')
        .select('first_name, last_name, email')
        .eq('applicant_id', applicantId)
        .maybeSingle(),
      supabase
        .from('job_applications')
        .select('job_posting_id')
        .eq('application_id', applicationId)
        .maybeSingle(),
    ]);

    const profile = profileResult.data;
    const jobPostingId = appResult.data?.job_posting_id;

    const { data: posting } = jobPostingId
      ? await supabase
          .from('job_postings')
          .select('title')
          .eq('job_posting_id', jobPostingId)
          .maybeSingle()
      : { data: null };

    const jobTitle = posting?.title ?? 'the position';
    const applicantName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      'Applicant';

    const statusMessages: Record<string, { title: string; message: string }> = {
      shortlisted: {
        title: 'You have been shortlisted!',
        message: `Congratulations! You have been shortlisted for ${jobTitle}. Our HR team will contact you soon.`,
      },
      on_hold: {
        title: 'Application On Hold',
        message: `Your application for ${jobTitle} has been placed on hold. We will notify you once a decision is made.`,
      },
      rejected: {
        title: 'Application Update',
        message: `Thank you for applying to ${jobTitle}. After review, your application was not selected at this time.`,
      },
      hired: {
        title: 'Congratulations – You are hired!',
        message: `You have been selected for ${jobTitle}! HR will contact you with onboarding details.`,
      },
    };

    const notif = statusMessages[status];
    if (!notif) return;

    // In-app notification (applicant)
    await this.notificationsService.createNotification({
      userId: applicantId,
      companyId,
      type: `APPLICATION_${status.toUpperCase()}`,
      title: notif.title,
      message: notif.message,
      metadata: { application_id: applicationId, status },
    });

    // Email notification (applicant)
    if (
      profile?.email &&
      ['shortlisted', 'on_hold', 'rejected'].includes(status)
    ) {
      await this.mailService.sendApplicationStatusEmail({
        to: profile.email,
        applicantName,
        jobTitle,
        status: status as 'shortlisted' | 'on_hold' | 'rejected',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Recruitment timeline
  // ---------------------------------------------------------------------------

  async logTimelineEvent(opts: {
    applicationId: string;
    companyId: string;
    eventType: string;
    fromStage?: string;
    toStage?: string;
    performedBy?: string;
    performedByName?: string;
    performedByRole?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  }) {
    const supabase = this.supabaseService.getClient();
    await supabase.from('recruitment_timeline').insert({
      event_id: crypto.randomUUID(),
      application_id: opts.applicationId,
      company_id: opts.companyId,
      event_type: opts.eventType,
      from_stage: opts.fromStage ?? null,
      to_stage: opts.toStage ?? null,
      performed_by: opts.performedBy ?? null,
      performed_by_name: opts.performedByName ?? null,
      performed_by_role: opts.performedByRole ?? null,
      notes: opts.notes ?? null,
      metadata: opts.metadata ?? null,
      occurred_at: new Date().toISOString(),
    });
  }

  async getRecruitmentTimeline(applicationId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify application belongs to company
    const { data: app } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (app) {
      await this.findOnePosting(app.job_posting_id, companyId);
    }

    const { data, error } = await supabase
      .from('recruitment_timeline')
      .select('*')
      .eq('application_id', applicationId)
      .order('occurred_at', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  // ---------------------------------------------------------------------------
  // Interview evaluations
  // ---------------------------------------------------------------------------

  async createInterviewEvaluation(
    applicationId: string,
    companyId: string,
    performedBy: string,
    dto: CreateInterviewEvaluationDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify application belongs to company
    const { data: app, error: appError } = await supabase
      .from('job_applications')
      .select('application_id, job_posting_id, applicant_id')
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
        stage: dto.stage,
        evaluator_id: dto.evaluator_id ?? performedBy,
        evaluator_name: dto.evaluator_name ?? null,
        overall_rating: dto.overall_rating ?? null,
        recommendation: dto.recommendation ?? null,
        technical_score: dto.technical_score ?? null,
        communication_score: dto.communication_score ?? null,
        culture_fit_score: dto.culture_fit_score ?? null,
        strengths: dto.strengths ?? null,
        weaknesses: dto.weaknesses ?? null,
        notes: dto.notes ?? null,
        evaluated_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // Log timeline event
    this.logTimelineEvent({
      applicationId,
      companyId,
      eventType: 'interview_evaluated',
      toStage: dto.stage,
      performedBy,
      metadata: {
        evaluation_id: evaluationId,
        recommendation: dto.recommendation,
      },
    }).catch(() => {});

    await this.auditService.log(
      `Interview evaluation created for application ${applicationId}, stage: ${dto.stage}`,
      performedBy,
      companyId,
    );

    return data;
  }

  async updateInterviewEvaluation(
    evaluationId: string,
    applicationId: string,
    companyId: string,
    performedBy: string,
    dto: UpdateInterviewEvaluationDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify ownership
    const { data: app } = await supabase
      .from('job_applications')
      .select('job_posting_id')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (!app) throw new NotFoundException('Application not found');
    await this.findOnePosting(app.job_posting_id, companyId);

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (dto.evaluator_name !== undefined)
      patch.evaluator_name = dto.evaluator_name;
    if (dto.overall_rating !== undefined)
      patch.overall_rating = dto.overall_rating;
    if (dto.recommendation !== undefined)
      patch.recommendation = dto.recommendation;
    if (dto.technical_score !== undefined)
      patch.technical_score = dto.technical_score;
    if (dto.communication_score !== undefined)
      patch.communication_score = dto.communication_score;
    if (dto.culture_fit_score !== undefined)
      patch.culture_fit_score = dto.culture_fit_score;
    if (dto.strengths !== undefined) patch.strengths = dto.strengths;
    if (dto.weaknesses !== undefined) patch.weaknesses = dto.weaknesses;
    if (dto.notes !== undefined) patch.notes = dto.notes;

    const { data, error } = await supabase
      .from('interview_evaluations')
      .update(patch)
      .eq('evaluation_id', evaluationId)
      .eq('application_id', applicationId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Evaluation not found');

    await this.auditService.log(
      `Interview evaluation updated: ${evaluationId}`,
      performedBy,
      companyId,
    );

    return data;
  }

  async getInterviewEvaluations(applicationId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app } = await supabase
      .from('job_applications')
      .select('job_posting_id')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (!app) throw new NotFoundException('Application not found');
    await this.findOnePosting(app.job_posting_id, companyId);

    const { data, error } = await supabase
      .from('interview_evaluations')
      .select('*')
      .eq('application_id', applicationId)
      .order('evaluated_at', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  // ---------------------------------------------------------------------------
  // Offer management
  // ---------------------------------------------------------------------------

  async createOffer(
    applicationId: string,
    companyId: string,
    performedBy: string,
    dto: CreateOfferDto,
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

    // Only one active offer per application
    const { data: existing } = await supabase
      .from('job_offers')
      .select('offer_id, status')
      .eq('application_id', applicationId)
      .not('status', 'eq', 'withdrawn')
      .maybeSingle();

    if (existing) {
      throw new ConflictException(
        `An active offer (status: ${existing.status}) already exists for this application. Withdraw it first.`,
      );
    }

    const offerId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('job_offers')
      .insert({
        offer_id: offerId,
        application_id: applicationId,
        company_id: companyId,
        status: 'draft',
        base_salary: dto.base_salary ?? null,
        currency: dto.currency ?? 'PHP',
        pay_frequency: dto.pay_frequency ?? 'monthly',
        start_date: dto.start_date ?? null,
        position_title: dto.position_title ?? null,
        department: dto.department ?? null,
        benefits: dto.benefits ?? null,
        offer_letter_notes: dto.offer_letter_notes ?? null,
        created_by: performedBy,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    await this.auditService.log(
      `Offer draft created for application ${applicationId}`,
      performedBy,
      companyId,
    );

    return data;
  }

  async sendOffer(
    offerId: string,
    applicationId: string,
    companyId: string,
    performedBy: string,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify offer ownership
    const { data: app } = await supabase
      .from('job_applications')
      .select('job_posting_id, applicant_id')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (!app) throw new NotFoundException('Application not found');
    const posting = await this.findOnePosting(app.job_posting_id, companyId);

    const { data: offer, error: offerError } = await supabase
      .from('job_offers')
      .select('*')
      .eq('offer_id', offerId)
      .eq('application_id', applicationId)
      .maybeSingle();

    if (offerError) throw new InternalServerErrorException(offerError.message);
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== 'draft')
      throw new BadRequestException(
        `Offer cannot be sent in status: ${offer.status}`,
      );

    const now = new Date().toISOString();

    // Update offer status to sent
    const { error: updateError } = await supabase
      .from('job_offers')
      .update({ status: 'sent', sent_at: now, updated_at: now })
      .eq('offer_id', offerId);

    if (updateError)
      throw new InternalServerErrorException(updateError.message);

    // Fetch applicant info
    const { data: profile } = await supabase
      .from('applicant_profile')
      .select('first_name, last_name, email')
      .eq('applicant_id', app.applicant_id)
      .maybeSingle();

    const applicantName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      'Applicant';

    // Send offer email
    if (profile?.email) {
      await this.mailService.sendOfferEmail({
        to: profile.email,
        applicantName,
        jobTitle: posting.title,
        positionTitle: offer.position_title,
        department: offer.department,
        baseSalary: offer.base_salary,
        currency: offer.currency,
        payFrequency: offer.pay_frequency,
        startDate: offer.start_date,
        benefits: offer.benefits
          ? JSON.stringify(offer.benefits, null, 2)
          : null,
        notes: offer.offer_letter_notes,
      });
    }

    // In-app notification to applicant
    await this.notificationsService.createNotification({
      userId: app.applicant_id,
      companyId,
      type: 'OFFER_RECEIVED',
      title: `You have received a job offer!`,
      message: `Please review your offer for the ${posting.title} position and respond at your earliest convenience.`,
      metadata: { offer_id: offerId, application_id: applicationId },
    });

    // Log timeline event
    this.logTimelineEvent({
      applicationId,
      companyId,
      eventType: 'offer_sent',
      toStage: 'offer_sent',
      performedBy,
    }).catch(() => {});

    await this.auditService.log(
      `Offer sent for application ${applicationId}`,
      performedBy,
      companyId,
    );

    return { message: 'Offer sent successfully', offer_id: offerId };
  }

  async respondToOffer(
    offerId: string,
    applicationId: string,
    applicantId: string,
    dto: RespondToOfferDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify applicant owns the application
    const { data: app } = await supabase
      .from('job_applications')
      .select('applicant_id, job_posting_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (!app || app.applicant_id !== applicantId)
      throw new NotFoundException('Application not found');

    const { data: offer, error: offerError } = await supabase
      .from('job_offers')
      .select('offer_id, status')
      .eq('offer_id', offerId)
      .eq('application_id', applicationId)
      .maybeSingle();

    if (offerError) throw new InternalServerErrorException(offerError.message);
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== 'sent')
      throw new BadRequestException(
        `Offer is not in a pending state (current: ${offer.status})`,
      );

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('job_offers')
      .update({
        status: dto.action,
        responded_at: now,
        applicant_response_note: dto.note ?? null,
        updated_at: now,
      })
      .eq('offer_id', offerId);

    if (error) throw new InternalServerErrorException(error.message);

    // Notify HR if offer accepted or declined
    const { data: posting } = await supabase
      .from('job_postings')
      .select('title, company_id')
      .eq('job_posting_id', app.job_posting_id)
      .maybeSingle();

    const companyId = posting?.company_id;
    if (companyId) {
      await this.notificationsService.notifyAllHRInCompany(companyId, {
        type: `OFFER_${dto.action.toUpperCase()}`,
        title: `Offer ${dto.action === 'accepted' ? 'Accepted' : 'Declined'}`,
        message: `An applicant has ${dto.action} the offer for ${posting?.title ?? 'a position'}.`,
        metadata: { offer_id: offerId, application_id: applicationId },
      });

      this.logTimelineEvent({
        applicationId,
        companyId,
        eventType: `offer_${dto.action}`,
        toStage: `offer_${dto.action}`,
        performedBy: applicantId,
        performedByRole: 'Applicant',
        notes: dto.note,
      }).catch(() => {});
    }

    return { message: `Offer ${dto.action} successfully`, offer_id: offerId };
  }

  async getOfferForApplication(applicationId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: app } = await supabase
      .from('job_applications')
      .select('job_posting_id')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (!app) throw new NotFoundException('Application not found');
    await this.findOnePosting(app.job_posting_id, companyId);

    const { data, error } = await supabase
      .from('job_offers')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  async getMyOffers(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: apps } = await supabase
      .from('job_applications')
      .select('application_id, job_postings(title, job_posting_id)')
      .eq('applicant_id', applicantId);

    if (!apps?.length) return [];
    const appIds = apps.map((a: any) => a.application_id);

    const { data: offers, error } = await supabase
      .from('job_offers')
      .select('*')
      .in('application_id', appIds)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);

    const appMap = new Map(apps.map((a: any) => [a.application_id, a]));
    return (offers ?? []).map((o: any) => ({
      ...o,
      job_title: appMap.get(o.application_id)?.job_postings?.title ?? '',
    }));
  }
}
