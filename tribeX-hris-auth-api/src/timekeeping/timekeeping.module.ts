import { Module } from '@nestjs/common';
import { TimekeepingController } from './timekeeping.controller';
import { TimekeepingService } from './timekeeping.service';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    AuthModule, // provides JwtAuthGuard, RolesGuard, Roles decorator
    SupabaseModule, // provides SupabaseService
  ],
  controllers: [TimekeepingController],
  providers: [TimekeepingService],
  exports: [TimekeepingService], // export so Yellow Tribe API or other modules can consume it
})
export class TimekeepingModule {}
