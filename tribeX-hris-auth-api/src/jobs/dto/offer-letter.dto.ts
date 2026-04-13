import { IsString, IsOptional, IsNumber, IsIn, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOfferLetterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  job_title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ example: '2024-06-01', required: false })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({ example: 75000, required: false })
  @IsOptional()
  @IsNumber()
  base_salary?: number;

  @ApiProperty({ example: 'USD', required: false })
  @IsOptional()
  @IsString()
  salary_currency?: string;

  @ApiProperty({ example: 'monthly', required: false })
  @IsOptional()
  @IsIn(['hourly', 'weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'annual'])
  pay_frequency?: string;

  @ApiProperty({ example: 5000, required: false })
  @IsOptional()
  @IsNumber()
  bonus?: number;

  @ApiProperty({ example: { health: true, dental: true, pto_days: 20 }, required: false })
  @IsOptional()
  benefits?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  additional_terms?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  offer_body?: string;

  @ApiProperty({ example: '2024-05-15T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

export class UpdateOfferStatusDto {
  @ApiProperty({ example: 'sent' })
  @IsIn(['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'declined', 'expired', 'revoked'])
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  applicant_response_notes?: string;
}
