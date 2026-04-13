import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApplicantJwtAuthGuard } from './applicant-jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    SupabaseModule,
    ConfigModule,
    forwardRef(() => MailModule),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error(
            'JWT_SECRET must be set and at least 32 characters long',
          );
        }
        return { secret, signOptions: { expiresIn: '1d' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, ApplicantJwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, ApplicantJwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}