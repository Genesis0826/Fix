import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateJobPostingDto {
  @IsString() @IsNotEmpty()
  title: string;

  @IsString() @IsNotEmpty()
  description: string;

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
}
