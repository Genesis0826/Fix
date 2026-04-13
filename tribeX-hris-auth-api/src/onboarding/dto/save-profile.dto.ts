import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsString, IsNotEmpty, IsOptional, IsDateString, IsEmail,
  IsArray, ValidateNested,
} from 'class-validator';

export class EmergencyContactDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  contact_name: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  relationship: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  emergency_phone_number: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsEmail() @IsOptional()
  emergency_email_address?: string;
}

export class SaveProfileDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  first_name: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  middle_name?: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  last_name: string;

  @ApiProperty() @IsEmail()
  email_address: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  phone_number: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  complete_address?: string;

  @ApiProperty({ required: false }) @IsDateString() @IsOptional()
  date_of_birth?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  place_of_birth?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  nationality?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  civil_status?: string;

  @ApiProperty({ type: [EmergencyContactDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergency_contacts: EmergencyContactDto[];

  // Legacy flat fields — kept optional for backward compat, ignored by service
  @ApiProperty({ required: false }) @IsString() @IsOptional()
  contact_name?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  relationship?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  emergency_phone_number?: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsEmail() @IsOptional()
  emergency_email_address?: string;
}
