import { Controller, Get, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // IMPORTANT: 'read-all' must be before ':id/read' to avoid NestJS route shadowing
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.sub_userid);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get notifications for the current user' })
  getMyNotifications(@Req() req: any) {
    return this.notificationsService.getForUser(req.user.sub_userid);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markRead(id, req.user.sub_userid);
  }
}
