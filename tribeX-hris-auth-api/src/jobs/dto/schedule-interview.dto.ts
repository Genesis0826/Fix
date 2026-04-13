import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ScheduleInterviewDto {
  @IsString() @IsNotEmpty()
  scheduled_date: string;      // "YYYY-MM-DD"

  @IsString() @IsNotEmpty()
  scheduled_time: string;      // "HH:MM"

  @IsInt() @Min(15)
  duration_minutes: number;

  @IsString() @IsIn(['in_person', 'video', 'phone'])
  format: 'in_person' | 'video' | 'phone';

  @IsString() @IsOptional()
  location?: string | null;

  @IsString() @IsOptional()
  meeting_link?: string | null;

  @IsString() @IsNotEmpty()
  interviewer_name: string;

  @IsString() @IsOptional()
  interviewer_title?: string | null;

  @IsString() @IsOptional()
  notes?: string | null;

  @IsString() @IsOptional()
  scheduled_by_email?: string | null;

  @IsString()
  @IsIn(['first_interview', 'technical_interview', 'final_interview'])
  @IsOptional()
  stage?: string | null;
}
