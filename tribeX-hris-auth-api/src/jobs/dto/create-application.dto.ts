import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ApplicationAnswerDto {
  @IsString()
  question_id: string;

  @IsString() @IsOptional()
  answer_value?: string;
}

export class CreateApplicationDto {
  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ApplicationAnswerDto)
  answers?: ApplicationAnswerDto[];
}
