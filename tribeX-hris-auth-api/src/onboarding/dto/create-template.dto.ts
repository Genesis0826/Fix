import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsArray, ValidateNested, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class TemplateItemDto {
  @ApiProperty({ example: 'upload' })
  @IsString() @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'documents' })
  @IsString() @IsNotEmpty()
  tab_category: string;

  @ApiProperty({ example: 'NBI Clearance' })
  @IsString() @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ required: false, description: 'JSON string for form fields, handbook text, or video URL' })
  @IsString() @IsOptional()
  rich_content?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  is_required: boolean;
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'Software Engineer Onboarding' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsUUID()
  department_id: string;

  @ApiProperty()
  @IsUUID()
  position_id: string;

  @ApiProperty({ example: 30 })
  @IsNumber()
  default_deadline_days: number;

  @ApiProperty({ type: [TemplateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items: TemplateItemDto[];
}
