import {
  IsString,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  IsIn,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class SaveOnboardingDto {
  @ApiPropertyOptional() @IsString() @IsOptional() first_name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() last_name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() address?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() date_of_birth?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() nationality?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() civil_status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() emergency_contact_name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() emergency_contact_phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() emergency_contact_relationship?: string;
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MinLength(3)
  @Matches(/^\S+$/, { message: 'Username must not contain spaces' })
  preferred_username?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() department_id?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() start_date?: string;
}

export class RejectOnboardingDto {
  @ApiProperty() @IsString() @IsNotEmpty() hr_notes: string;
}

export class ApproveOnboardingDto {
  @ApiProperty({ description: 'role_id of the employee role to assign' })
  @IsString()
  @IsNotEmpty()
  role_id: string;
}
