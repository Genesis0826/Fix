import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInterviewEvaluationDto {
  @ApiProperty({
    description: 'Interview stage, e.g. technical_interview or final_interview',
  })
  @IsString()
  @IsNotEmpty()
  stage: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  evaluator_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evaluator_name?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overall_rating?: number;

  @ApiPropertyOptional({ enum: ['pass', 'fail', 'hold'] })
  @IsOptional()
  @IsEnum(['pass', 'fail', 'hold'])
  recommendation?: 'pass' | 'fail' | 'hold';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  technical_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  communication_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  culture_fit_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strengths?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  weaknesses?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateInterviewEvaluationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evaluator_name?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overall_rating?: number;

  @ApiPropertyOptional({ enum: ['pass', 'fail', 'hold'] })
  @IsOptional()
  @IsEnum(['pass', 'fail', 'hold'])
  recommendation?: 'pass' | 'fail' | 'hold';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  technical_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  communication_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  culture_fit_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strengths?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  weaknesses?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
