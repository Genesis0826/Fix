import { IsString, IsOptional, IsNumber, IsIn, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInterviewEvaluationDto {
  @ApiProperty({ example: 'first_interview' })
  @IsString()
  interview_stage: string;

  @ApiProperty({ example: 'Jane Smith', required: false })
  @IsOptional()
  @IsString()
  evaluator_name?: string;

  @ApiProperty({ example: 8.5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  technical_score?: number;

  @ApiProperty({ example: 9.0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  communication_score?: number;

  @ApiProperty({ example: 7.5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  culture_fit_score?: number;

  @ApiProperty({ example: 8.3, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  overall_score?: number;

  @ApiProperty({ example: 'hire', required: false })
  @IsOptional()
  @IsString()
  @IsIn(['strong_hire', 'hire', 'hold', 'no_hire', 'pending'])
  recommendation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  strengths?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  weaknesses?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
