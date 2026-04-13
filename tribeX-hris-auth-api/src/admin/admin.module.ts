import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditModule } from '../audit/audit.module';
import { PillarModule } from '../pillar/pillar.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [SupabaseModule, AuditModule, PillarModule, NotificationsModule, MailModule],
  providers: [AdminService, ScheduledTasksService],
  controllers: [AdminController],
  exports: [AdminService, ScheduledTasksService], // Export so other modules can use them
})
export class AdminModule {}
