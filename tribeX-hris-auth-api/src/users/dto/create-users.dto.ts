// for creating users, not for login, login is in auth module
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\S+$/, {
    message: 'Username must not contain spaces',
  })
  username: string;

  @IsString()
  @IsNotEmpty()
  role_id: string; // varchar in DB ("RID010"), not a number

  @IsString()
  @IsOptional()
  department_id?: string;

  @IsString()
  @IsOptional()
  start_date?: string; // ISO date string, e.g. "2024-07-01"

  @IsString() @IsOptional()
  company_id?: string;
}
