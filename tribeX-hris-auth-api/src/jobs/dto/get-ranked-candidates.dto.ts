import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetRankedCandidatesDto {
  @IsOptional()
  @IsIn(['sfia', 'manual'])
  mode?: 'sfia' | 'manual';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
