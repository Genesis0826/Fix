import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOfferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  base_salary?: number;

  @ApiPropertyOptional({ default: 'PHP' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    enum: ['hourly', 'daily', 'weekly', 'bi_weekly', 'monthly', 'annually'],
    default: 'monthly',
  })
  @IsOptional()
  @IsEnum(['hourly', 'daily', 'weekly', 'bi_weekly', 'monthly', 'annually'])
  pay_frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position_title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    description: 'JSON object describing benefits (health, leave, etc.)',
  })
  @IsOptional()
  benefits?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  offer_letter_notes?: string;
}

export class RespondToOfferDto {
  @ApiProperty({ enum: ['accepted', 'declined'] })
  @IsNotEmpty()
  @IsEnum(['accepted', 'declined'])
  action: 'accepted' | 'declined';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
