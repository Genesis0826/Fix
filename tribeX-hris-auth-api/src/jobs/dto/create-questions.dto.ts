import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ApplicationQuestionDto {
  @IsString()
  question_text: string;

  @IsString()
  question_type: string;

  @IsOptional()
  options?: any;

  @IsBoolean() @IsOptional()
  is_required?: boolean;

  @IsNumber() @IsOptional()
  sort_order?: number;
}

export class SetQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationQuestionDto)
  questions: ApplicationQuestionDto[];
}
