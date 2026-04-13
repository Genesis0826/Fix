import { Controller, Get, Patch, Body, Param, Request } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { UpdateSfiaSettingsDto } from './dto/sfia-settings.dto';

@Controller('admin/sfia')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly scheduledTasksService: ScheduledTasksService,
  ) {}

  @Get('settings/:companyId')
  async getSfiaSettings(@Param('companyId') companyId: string) {
    return this.adminService.getSfiaSettings(companyId);
  }

  @Patch('settings/:companyId')
  async updateSfiaSettings(
    @Param('companyId') companyId: string,
    @Body() updates: UpdateSfiaSettingsDto,
    @Request() req: any,
  ) {
    // NOTE: Auth guards (JWT + System Admin role check) to be added in security hardening pass
    const adminUserId = req.user?.id;
    return this.adminService.updateSfiaSettings(companyId, updates, adminUserId);
  }

  @Patch('toggle/:companyId')
  async toggleSfiaStatus(
    @Param('companyId') companyId: string,
    @Body('enabled') enabled: boolean,
    @Request() req: any,
  ) {
    const adminUserId = req.user?.id;
    return this.adminService.toggleSfiaStatus(companyId, enabled, adminUserId);
  }

  @Patch('reset-failures/:companyId')
  async resetFailureCounter(
    @Param('companyId') companyId: string,
    @Request() req: any,
  ) {
    const adminUserId = req.user?.id;
    return this.adminService.resetSfiaFailureCounter(companyId, adminUserId);
  }

  @Get('health/:companyId')
  async checkHealth(@Param('companyId') companyId: string) {
    return this.scheduledTasksService.manualHealthCheck(companyId);
  }

  @Get('health-status/:companyId')
  async getHealthStatus(@Param('companyId') companyId: string) {
    return this.scheduledTasksService.getHealthStatus(companyId);
  }

  @Get('health-status-all')
  async getAllHealthStatus() {
    return this.scheduledTasksService.getAllHealthStatus();
  }
}
