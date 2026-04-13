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
import { ApplicantJwtAuthGuard } from '../auth/applicant-jwt-auth.guard';

@ApiTags('Applicant Portal Onboarding')
@ApiBearerAuth()
@Controller('onboarding/portal')
@UseGuards(ApplicantJwtAuthGuard)
export class ApplicantPortalOnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('session')
  @ApiOperation({ summary: 'Get applicant onboarding session (4-stage wizard)' })
  async getMySession(@Req() req: any) {
    const session = await this.onboardingService.getSessionByApplicantId(req.user.sub_userid);
    return session ?? null; // explicit null so NestJS sends valid JSON body
  }

  @Post('upload-document')
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
  @ApiOperation({ summary: 'Confirm a text-based task' })
  confirmTask(@Param('onboardingItemId') onboardingItemId: string) {
    return this.onboardingService.confirmTask(onboardingItemId);
  }

  @Put('session/:sessionId/profile')
  @ApiOperation({ summary: 'Save or update personal and emergency contact info' })
  saveProfile(
    @Param('sessionId') sessionId: string,
    @Body() dto: SaveProfileDto,
  ) {
    return this.onboardingService.saveProfile(sessionId, dto);
  }

  @Post('session/:sessionId/submit')
  @ApiOperation({ summary: 'Submit onboarding for HR review' })
  submitForReview(@Param('sessionId') sessionId: string) {
    return this.onboardingService.submitForReview(sessionId);
  }

  @Patch('items/:onboardingItemId/request-equipment')
  @ApiOperation({ summary: 'Submit equipment request with delivery preference' })
  requestEquipment(
    @Param('onboardingItemId') onboardingItemId: string,
    @Body() body: { is_requested: boolean; delivery_method: 'office' | 'delivery'; delivery_address?: string },
  ) {
    return this.onboardingService.requestEquipment(onboardingItemId, body);
  }
}
