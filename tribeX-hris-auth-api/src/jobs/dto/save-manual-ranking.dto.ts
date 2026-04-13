import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ManualRankingItemDto {
  @IsString()
  application_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  rank: number;
}

export class SaveManualRankingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualRankingItemDto)
  rankings: ManualRankingItemDto[];
}
