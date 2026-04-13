import { IsOptional, IsString } from 'class-validator';

export class UpdateJobPostingDto {
  @IsString() @IsOptional()
  title?: string;

  @IsString() @IsOptional()
  description?: string;

  @IsString() @IsOptional()
  location?: string;

  @IsString() @IsOptional()
  employment_type?: string;

  @IsString() @IsOptional()
  salary_range?: string;

  @IsString() @IsOptional()
  department_id?: string;

  @IsString() @IsOptional()
  closes_at?: string;

  @IsString() @IsOptional()
  status?: string;
}
