import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AbsenceReason {
  SICK      = 'Sick Leave',
  EMERGENCY = 'Emergency Leave',
  WFH       = 'WFH / Remote',
  PERSONAL  = 'Personal Leave',
  VACATION  = 'Vacation Leave',
  APPROVED  = 'On Leave (Approved)',
  OTHER     = 'Other',
}

export class ReportAbsenceDto {
  @ApiProperty({ enum: AbsenceReason, description: 'Reason for absence' })
  @IsEnum(AbsenceReason)
  reason: AbsenceReason;

  @ApiPropertyOptional({ description: 'Optional additional notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
