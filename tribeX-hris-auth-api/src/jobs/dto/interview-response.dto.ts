import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InterviewResponseDto {
  @IsString()
  @IsIn(['accepted', 'declined', 'reschedule_requested'])
  action: 'accepted' | 'declined' | 'reschedule_requested';

  @IsString()
  @IsNotEmpty({ message: 'A reason is required.' })
  note: string;

  @IsString()
  @IsIn(['first_interview', 'technical_interview', 'final_interview'])
  @IsOptional()
  stage?: string | null;
}
