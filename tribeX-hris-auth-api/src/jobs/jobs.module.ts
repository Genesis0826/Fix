import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PillarModule } from '../pillar/pillar.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { AdminModule } from '../admin/admin.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    AuthModule,
    SupabaseModule,
    AuditModule,
    MailModule,
    NotificationsModule,
    PillarModule,
    OnboardingModule,
    AdminModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
