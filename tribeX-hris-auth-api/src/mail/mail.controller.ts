import {
  Controller,
  Get,
  Query,
  BadRequestException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('mail')
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  @Get('test')
  async testEmail(@Query('to') to: string) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Not available in production');
    }
    if (!to) throw new BadRequestException('Missing ?to= query param');

    await this.mailService.sendInvite(
      to,
      'http://localhost:3000/set-password?token=test-token',
    );
    return { message: `Test email sent to ${to}` };
  }
}
