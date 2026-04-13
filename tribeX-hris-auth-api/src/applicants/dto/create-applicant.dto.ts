// src/applicants/dto/create-applicant.dto.ts
// Fields for applicant self-registration on the Career Portal.

import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicantDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  first_name: string;

  @ApiProperty({ example: 'Dela Cruz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  last_name: string;

  @ApiProperty({ example: 'juan.delacruz@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: '+639171234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone_number?: string;

  // Passed as a query param (?company=COMP-001) from the company-specific registration link.
  // Stored in applicant_profile and included in the JWT so jobs can be scoped to the right company.
  @ApiPropertyOptional({ example: 'COMP-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  company_id?: string;
}
