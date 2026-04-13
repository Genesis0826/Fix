import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateApplicationRankingStatusDto {
  @ApiProperty({ example: 'shortlisted', description: 'Applicant-facing ranking status' })
  @IsIn(['shortlisted', 'not_shortlisted', 'on_hold'])
  ranking_status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
