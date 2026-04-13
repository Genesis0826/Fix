import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { TimekeepingModule } from './timekeeping/timekeeping.module';
import { ApplicantsModule } from './applicants/applicants.module';
import { JobsModule } from './jobs/jobs.module';
import { AuditModule } from './audit/audit.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { PillarModule } from './pillar/pillar.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // ✅ IMPORTANT
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    SupabaseModule,
    AuthModule,
    UsersModule,
    MailModule,
    TimekeepingModule,
    ApplicantsModule,
    JobsModule,
    AuditModule,
    OnboardingModule,
    NotificationsModule,
    AdminModule,
    PillarModule,
  ],
})
export class AppModule {}