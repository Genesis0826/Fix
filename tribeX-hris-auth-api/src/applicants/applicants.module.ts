// src/applicants/applicants.module.ts

import { Module } from '@nestjs/common';
import { ApplicantsController } from './applicants.controller';
import { ApplicantsService } from './applicants.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { MailModule } from '../mail/mail.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [ApplicantsController],
  providers: [ApplicantsService],
  imports: [SupabaseModule, MailModule, AuthModule],
})
export class ApplicantsModule {}
