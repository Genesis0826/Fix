import {
  Controller, Get, Post, Put, Patch, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { SaveProfileDto } from './dto/save-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const ONBOARDING_USERS = ['Employee', 'Manager', 'HR Officer', 'Admin', 'System Admin'];

@ApiTags('Applicant Onboarding')
@ApiBearerAuth()
@Controller('onboarding/applicant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicantOnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('session')
  @Roles(...ONBOARDING_USERS)
  @ApiOperation({ summary: 'Get my full onboarding session with all items grouped by category' })
  getMySession(@Req() req: any) {
    return this.onboardingService.getMySession(req.user.sub_userid);
  }

  @Post('upload-document')
  @Roles(...ONBOARDING_USERS)
  @ApiOperation({ summary: 'Upload a document or equipment receipt photo' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'isProofOfReceipt', required: false, type: Boolean })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadDocument(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @Query('isProofOfReceipt') isProofOfReceipt?: string,
  ) {
    return this.onboardingService.uploadDocument(
      dto.onboardingItemId,
      file,
      isProofOfReceipt === 'true',
    );
  }

  @Post('items/:onboardingItemId/confirm')
  @Roles(...ONBOARDING_USERS)
  @ApiOperation({ summary: 'Confirm a text-based task (handbook, video, code of conduct)' })
  confirmTask(@Param('onboardingItemId') onboardingItemId: string) {
    return this.onboardingService.confirmTask(onboardingItemId);
  }

  @Put('session/:sessionId/profile')
  @Roles(...ONBOARDING_USERS)
  @ApiOperation({ summary: 'Save or update personal and emergency contact info' })
  saveProfile(
    @Param('sessionId') sessionId: string,
    @Body() dto: SaveProfileDto,
  ) {
    return this.onboardingService.saveProfile(sessionId, dto);
  }

  @Post('session/:sessionId/submit')
  @Roles(...ONBOARDING_USERS)
  @ApiOperation({ summary: 'Submit onboarding for HR review' })
  submitForReview(@Param('sessionId') sessionId: string) {
    return this.onboardingService.submitForReview(sessionId);
  }

  @Patch('items/:onboardingItemId/request-equipment')
  @Roles(...ONBOARDING_USERS)
  @ApiOperation({ summary: 'Submit equipment request with delivery preference' })
  requestEquipment(
    @Param('onboardingItemId') onboardingItemId: string,
    @Body() body: { is_requested: boolean; delivery_method: 'office' | 'delivery'; delivery_address?: string },
  ) {
    return this.onboardingService.requestEquipment(onboardingItemId, body);
  }
}
