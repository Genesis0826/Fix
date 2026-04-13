import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class AssignTemplateDto {
  @ApiProperty() @IsUUID()
  account_id: string;

  @ApiProperty() @IsUUID()
  template_id: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  assigned_position: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  assigned_department: string;

  @ApiProperty() @IsDateString()
  deadline_date: string;
}
