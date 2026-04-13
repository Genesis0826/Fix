import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TimePunchDto {
  @ApiPropertyOptional({
    description: 'GPS latitude coordinate (optional — omit if location is unavailable)',
    example: 14.5995,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'GPS longitude coordinate (optional — omit if location is unavailable)',
    example: 120.9842,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
