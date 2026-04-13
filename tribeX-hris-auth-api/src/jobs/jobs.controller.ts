import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplicantJwtAuthGuard } from '../auth/applicant-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { JobsService } from './jobs.service';
import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { UpdateJobPostingDto } from './dto/update-job-posting.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { SetQuestionsDto } from './dto/create-questions.dto';
import { GetRankedCandidatesDto } from './dto/get-ranked-candidates.dto';
import { SaveManualRankingDto } from './dto/save-manual-ranking.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { InterviewResponseDto } from './dto/interview-response.dto';

const HR_AND_ABOVE = ['Admin', 'System Admin', 'HR Officer', 'HR Recruiter', 'HR Interviewer', 'Manager'];

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // ---------------------------------------------------------------------------
  // PUBLIC ROUTES — no auth required
  // ---------------------------------------------------------------------------

  @Get('public/careers/:slug')
  @ApiOperation({ summary: 'Public: Get company info + open jobs by slug' })
  getPublicCareersBySlug(@Param('slug') slug: string) {
    return this.jobsService.getPublicCareersBySlug(slug);
  }

  // ---------------------------------------------------------------------------
  // APPLICANT ROUTES — must come before /:id routes to avoid param collision
  // ---------------------------------------------------------------------------

  @Get('applicant/open')
  @UseGuards(ApplicantJwtAuthGuard)
  @ApiOperation({ summary: 'Applicant: Browse open job listings for their company' })
  getOpenJobsForApplicant(@Req() req: any) {
    return this.jobsService.getOpenJobsForApplicant(req.user.company_id ?? null);
  }

  @Get('applicant/my-applications')
  @UseGuards(ApplicantJwtAuthGuard)
  @ApiOperation({ summary: 'Applicant: View own submitted applications' })
  getMyApplications(@Req() req: any) {
    return this.jobsService.getMyApplications(req.user.sub_userid);
  }

  @Get('applicant/my-applications/:applicationId')
  @UseGuards(ApplicantJwtAuthGuard)
  @ApiOperation({ summary: 'Applicant: Get own application detail with answers' })
  getMyApplicationDetail(@Param('applicationId') applicationId: string, @Req() req: any) {
    return this.jobsService.getMyApplicationDetail(applicationId, req.user.sub_userid);
  }

  @Get('applicant/my-interview-schedules')
  @UseGuards(ApplicantJwtAuthGuard)
  @ApiOperation({ summary: 'Applicant: Get all interview schedules across all applications' })
  getMyInterviewSchedules(@Req() req: any) {
    return this.jobsService.getMyInterviewSchedules(req.user.sub_userid);
  }

  @Post('applicant/my-applications/:applicationId/interview-response')
  @UseGuards(ApplicantJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Applicant: Accept, decline, or request reschedule for an interview' })
  respondToInterview(
    @Param('applicationId') applicationId: string,
    @Body() dto: InterviewResponseDto,
    @Req() req: any,
  ) {
    return this.jobsService.respondToInterview(applicationId, req.user.sub_userid, dto);
  }

  // ---------------------------------------------------------------------------
  // HR APPLICATION DETAIL — must be before /:id to avoid param collision
  // ---------------------------------------------------------------------------

  @Get('applications/:applicationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Get a single application with answers' })
  getApplicationDetail(@Param('applicationId') applicationId: string, @Req() req: any) {
    return this.jobsService.getApplicationDetail(applicationId, req.user.company_id);
  }

  @Patch('applications/:applicationId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Update an application status' })
  updateApplicationStatus(
    @Param('applicationId') applicationId: string,
    @Body() body: { status: string },
    @Req() req: any,
  ) {
    return this.jobsService.updateApplicationStatus(applicationId, body.status, req.user.company_id);
  }

  @Post('applications/:applicationId/interview-schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'HR: Schedule an interview and notify applicant by email' })
  scheduleInterview(
    @Param('applicationId') applicationId: string,
    @Body() dto: ScheduleInterviewDto,
    @Req() req: any,
  ) {
    return this.jobsService.scheduleInterview(applicationId, dto, req.user.company_id);
  }

  @Post('applications/:applicationId/interview-schedule/resend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'HR: Resend the interview schedule email to the applicant' })
  resendInterviewEmail(
    @Param('applicationId') applicationId: string,
    @Req() req: any,
  ) {
    return this.jobsService.resendInterviewEmail(applicationId, req.user.company_id);
  }

  @Delete('applications/:applicationId/interview-schedule/:stage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'HR: Cancel an interview schedule for a specific stage and notify the applicant' })
  cancelInterviewSchedule(
    @Param('applicationId') applicationId: string,
    @Param('stage') stage: string,
    @Query('reason') reason: string | undefined,
    @Req() req: any,
  ) {
    return this.jobsService.cancelInterviewSchedule(applicationId, stage, req.user.company_id, reason);
  }

  @Get('hr/interview-notifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Get applicant interview responses (accepted / declined / reschedule_requested)' })
  getHRInterviewNotifications(@Req() req: any) {
    return this.jobsService.getHRInterviewNotifications(req.user.company_id);
  }

  // ---------------------------------------------------------------------------
  // HR ROUTES — require HR/Manager JWT
  // ---------------------------------------------------------------------------

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'HR: Create a new job posting' })
  createPosting(@Body() dto: CreateJobPostingDto, @Req() req: any) {
    return this.jobsService.createPosting(dto, req.user.company_id, req.user.sub_userid);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: List all job postings for this company' })
  findAllPostings(@Req() req: any) {
    return this.jobsService.findAllPostings(req.user.company_id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Get a single job posting' })
  findOnePosting(@Param('id') id: string, @Req() req: any) {
    return this.jobsService.findOnePosting(id, req.user.company_id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Update a job posting' })
  updatePosting(@Param('id') id: string, @Body() dto: UpdateJobPostingDto, @Req() req: any) {
    return this.jobsService.updatePosting(id, dto, req.user.company_id, req.user.sub_userid);
  }

  @Patch(':id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Close a job posting' })
  closePosting(@Param('id') id: string, @Req() req: any) {
    return this.jobsService.closePosting(id, req.user.company_id, req.user.sub_userid);
  }

  @Put(':id/questions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Set application form questions for a job posting' })
  setQuestions(@Param('id') id: string, @Body() dto: SetQuestionsDto, @Req() req: any) {
    return this.jobsService.setQuestionsForPosting(id, dto.questions, req.user.company_id, req.user.sub_userid);
  }

  @Get(':id/questions')
  @ApiOperation({ summary: 'Public: Get application questions for a job posting' })
  getQuestions(@Param('id') id: string) {
    return this.jobsService.getQuestionsForPosting(id);
  }

  @Get(':id/candidates/ranked')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Get ranked candidates for a job posting' })
  getRankedCandidates(
    @Param('id') id: string,
    @Query() query: GetRankedCandidatesDto,
    @Req() req: any,
  ) {
    return this.jobsService.getRankedCandidates(id, req.user.company_id, query);
  }

  @Put(':id/candidates/manual-rank')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Save manual candidate ranking for a job posting' })
  saveManualRanking(
    @Param('id') id: string,
    @Body() dto: SaveManualRankingDto,
    @Req() req: any,
  ) {
    return this.jobsService.saveManualRanking(
      id,
      req.user.company_id,
      req.user.sub_userid,
      dto.rankings,
    );
  }

  @Get(':id/applications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: View all applicants for a job posting' })
  getApplicationsForJob(@Param('id') id: string, @Req() req: any) {
    return this.jobsService.getApplicationsForJob(id, req.user.company_id);
  }

  // ---------------------------------------------------------------------------
  // APPLICANT APPLY ROUTE
  // ---------------------------------------------------------------------------

  @Post(':id/apply')
  @UseGuards(ApplicantJwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Applicant: Apply to a job posting' })
  applyToJob(
    @Param('id') id: string,
    @Body() dto: CreateApplicationDto,
    @Req() req: any,
  ) {
    return this.jobsService.applyToJob(id, req.user.sub_userid, req.user.company_id ?? null, dto);
  }
}
