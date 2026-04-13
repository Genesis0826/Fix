// Routes for the "New Hire Approval" flow (onboarding_submissions table).
// Applicants fill their profile after being marked hired; HR approves to create their employee account.

import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { ApplicantJwtAuthGuard } from '../auth/applicant-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

const HR_AND_ABOVE = ['Admin', 'System Admin', 'HR Officer', 'HR Recruiter', 'HR Interviewer', 'Manager'];

@ApiTags('New Hire Onboarding')
@ApiBearerAuth()
@Controller('onboarding')
export class NewHireController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ── Applicant endpoints ────────────────────────────────────────────────────

  @Get('my-onboarding')
  @UseGuards(ApplicantJwtAuthGuard)
  @ApiOperation({ summary: 'Applicant: get own onboarding submission' })
  getMyOnboarding(@Req() req: any) {
    return this.onboardingService.getMyOnboarding(req.user.sub_userid);
  }

  @Put('my-onboarding')
  @UseGuards(ApplicantJwtAuthGuard)
  @ApiOperation({ summary: 'Applicant: save onboarding submission draft' })
  saveOnboarding(@Req() req: any, @Body() body: Record<string, any>) {
    return this.onboardingService.saveOnboarding(req.user.sub_userid, body);
  }

  @Post('my-onboarding/submit')
  @UseGuards(ApplicantJwtAuthGuard)
  @ApiOperation({ summary: 'Applicant: submit onboarding for HR review' })
  submitOnboarding(@Req() req: any) {
    return this.onboardingService.submitOnboarding(req.user.sub_userid);
  }

  // ── HR endpoints ───────────────────────────────────────────────────────────

  @Get('submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: list all new hire submissions' })
  getSubmissions(@Req() req: any, @Query('status') status?: string) {
    return this.onboardingService.getHROnboardingSubmissions(req.user.company_id, status);
  }

  @Get('submissions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: get single submission' })
  getSubmission(@Param('id') id: string, @Req() req: any) {
    return this.onboardingService.getHROnboardingSubmission(id, req.user.company_id);
  }

  @Post('submissions/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: approve submission and create employee account' })
  approveSubmission(
    @Param('id') id: string,
    @Body('role_id') roleId: string,
    @Req() req: any,
  ) {
    return this.onboardingService.approveOnboardingSubmission(id, roleId, req.user.company_id);
  }

  @Post('submissions/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: reject submission with feedback' })
  rejectSubmission(
    @Param('id') id: string,
    @Body('hr_notes') hrNotes: string,
    @Req() req: any,
  ) {
    return this.onboardingService.rejectOnboardingSubmission(id, hrNotes, req.user.company_id);
  }
}
