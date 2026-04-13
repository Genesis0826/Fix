import { IsDateString } from 'class-validator';

export class UpdateDeadlineDto {
  @IsDateString()
  deadline_date: string;
}
