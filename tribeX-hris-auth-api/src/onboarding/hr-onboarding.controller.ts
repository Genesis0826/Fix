import { Controller, Get, Patch, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AddRemarkDto } from './dto/add-remark.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const HR_ONLY = ['HR Officer', 'HR Recruiter', 'Admin', 'System Admin'];

@ApiTags('HR Onboarding Management')
@ApiBearerAuth()
@Controller('onboarding/hr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HrOnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('sessions')
  @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'List all onboarding sessions with employee names' })
  getAllSessions() {
    return this.onboardingService.getAllOnboardingSessions();
  }

  @Get('sessions/:sessionId')
  @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'Get full detail of a single onboarding session' })
  getSession(@Param('sessionId') sessionId: string) {
    return this.onboardingService.getSessionById(sessionId);
  }

  @Patch('items/:onboardingItemId')
  @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'Approve, reject, or update status of an onboarding item' })
  updateItemStatus(
    @Param('onboardingItemId') onboardingItemId: string,
    @Body() dto: UpdateTaskStatusDto,
    @Req() req: any,
  ) {
    return this.onboardingService.updateItemStatus(onboardingItemId, dto, req.user.sub_userid);
  }

  @Post('remarks')
  @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'Add a remark to an onboarding session' })
  addRemark(@Body() dto: AddRemarkDto, @Req() req: any) {
    return this.onboardingService.addRemark(dto, req.user.sub_userid);
  }

  @Patch('sessions/:sessionId/deadline')
  @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'Update the deadline of an onboarding session' })
  updateDeadline(@Param('sessionId') sessionId: string, @Body() dto: UpdateDeadlineDto) {
    return this.onboardingService.updateSessionDeadline(sessionId, dto.deadline_date);
  }

  @Post('sessions/:sessionId/approve')
  @Roles(...HR_ONLY)
  @ApiOperation({ summary: 'Final approval of completed onboarding' })
  approveSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.onboardingService.approveSession(sessionId, req.user.sub_userid);
  }
}
