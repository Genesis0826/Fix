import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [AuthModule, SupabaseModule, MailModule, AuditModule, NotificationsModule],
})
export class UsersModule {}
