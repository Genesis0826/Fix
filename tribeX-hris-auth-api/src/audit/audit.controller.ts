import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'System Admin')
  @ApiOperation({ summary: 'System Admin: Get paginated audit logs' })
  getLogs(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.getLogs(
      req.user.company_id,
      limit ? Number.parseInt(limit, 10) : 50,
      offset ? Number.parseInt(offset, 10) : 0,
    );
  }

  @Get('logs/count')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'System Admin')
  @ApiOperation({ summary: 'System Admin: Get total audit log count' })
  getLogsCount(@Req() req: any) {
    return this.auditService.getLogsCount(req.user.company_id);
  }
}
