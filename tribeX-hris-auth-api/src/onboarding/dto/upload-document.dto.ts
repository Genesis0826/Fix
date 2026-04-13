import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ description: 'The UUID of the onboarding_item' })
  @IsUUID()
  @IsNotEmpty()
  onboardingItemId: string;

  @ApiProperty({ type: 'string', format: 'binary', description: 'PDF, JPG, or PNG (Max 5MB)' })
  file: any;
}
