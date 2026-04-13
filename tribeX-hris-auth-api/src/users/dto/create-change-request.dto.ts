import { IsEnum, IsString, IsObject, IsOptional, MinLength } from 'class-validator';

export class CreateChangeRequestDto {
  @IsEnum(['legal_name', 'bank'])
  field_type: 'legal_name' | 'bank';

  @IsObject()
  requested_changes: Record<string, string>;

  @IsString()
  @MinLength(5)
  reason: string;

  @IsOptional()
  @IsString()
  supporting_doc_url?: string;
}
