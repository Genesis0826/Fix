import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditModule } from '../audit/audit.module';
import { PillarModule } from '../pillar/pillar.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SupabaseModule, AuditModule, PillarModule, MailModule, NotificationsModule],
  providers: [AdminService, ScheduledTasksService],
  controllers: [AdminController],
  exports: [AdminService, ScheduledTasksService],
})
export class AdminModule {}
