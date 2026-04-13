import { Module, forwardRef } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [forwardRef(() => AuthModule), SupabaseModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
