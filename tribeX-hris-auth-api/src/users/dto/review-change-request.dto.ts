import { IsEnum, IsString, MinLength } from 'class-validator';

export class ReviewChangeRequestDto {
  @IsEnum(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsString()
  @MinLength(3)
  review_reason: string;
}
