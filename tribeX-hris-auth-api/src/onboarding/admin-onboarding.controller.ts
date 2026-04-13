import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { AssignTemplateDto } from './dto/assign-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('System Admin Onboarding')
@ApiBearerAuth()
@Controller('onboarding/system-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminOnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('templates')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Create a new onboarding template with items' })
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.onboardingService.createTemplate(dto);
  }

  @Get('templates')
  @Roles('System Admin')
  @ApiOperation({ summary: 'List all onboarding templates with their items' })
  getAllTemplates() {
    return this.onboardingService.getAllTemplates();
  }

  @Post('assign')
  @Roles('System Admin', 'HR Officer')
  @ApiOperation({ summary: 'Assign a template to an employee, creating their onboarding session' })
  assignTemplate(@Body() dto: AssignTemplateDto) {
    return this.onboardingService.assignTemplate(dto);
  }

  @Get('positions')
  @Roles('System Admin')
  @ApiOperation({ summary: 'List all job positions with department names' })
  getPositions() {
    return this.onboardingService.getAllPositions();
  }

  @Post('positions')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Create a new job position' })
  createPosition(@Body() body: { department_id: string; position_name: string }) {
    return this.onboardingService.createPosition(body);
  }

  @Get('departments')
  @Roles('System Admin', 'HR Officer')
  @ApiOperation({ summary: 'List all departments' })
  getDepartments() {
    return this.onboardingService.getDepartments();
  }

  @Post('templates/:templateId/items')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Add a new item to an existing template' })
  addTemplateItem(
    @Param('templateId') templateId: string,
    @Body() body: { type: string; tab_category: string; title: string; description?: string; is_required: boolean },
  ) {
    return this.onboardingService.addTemplateItem(templateId, body);
  }

  @Patch('template-items/:itemId')
  @Roles('System Admin')
  @ApiOperation({ summary: 'Update a template item (title, description, is_required)' })
  updateTemplateItem(
    @Param('itemId') itemId: string,
    @Body() body: { title?: string; description?: string; is_required?: boolean },
  ) {
    return this.onboardingService.updateTemplateItem(itemId, body);
  }

  /**
   * Admin/audit revoke endpoint: resets an approved onboarding session back to
   * "for-review" status. Only System Admins may perform this action.
   * An optional reason body field is recorded in the audit log.
   */
  @Delete('sessions/:sessionId/revoke')
  @Roles('System Admin')
  @ApiOperation({ summary: 'System Admin: Revoke an approved onboarding session (audit/compliance)' })
  revokeSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.onboardingService.revokeSession(sessionId, req.user.sub_userid, body.reason);
  }
}
