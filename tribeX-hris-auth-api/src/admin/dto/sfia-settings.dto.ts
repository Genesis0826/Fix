import { IsBoolean, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class SfiaSettingsDto {
  @IsBoolean()
  sfia_enabled: boolean;

  @IsNumber()
  @Min(0)
  @Max(10)
  exact_match_points: number; // Default: 3

  @IsNumber()
  @Min(0)
  @Max(10)
  above_demand_points: number; // Default: 1.5

  @IsNumber()
  @Min(0)
  @Max(100)
  failover_threshold_percentage: number; // Default: 50 - auto-switch to manual if match % below this

  @IsNumber()
  @Min(1)
  @Max(10)
  max_consecutive_failures: number; // Default: 2 - switch to manual after 2 failures

  @IsNumber()
  @Min(1)
  healthcheck_interval_seconds: number; // Default: 60 - polling interval for Pillar health
}

export class UpdateSfiaSettingsDto {
  @IsOptional()
  @IsBoolean()
  sfia_enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  exact_match_points?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  above_demand_points?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  failover_threshold_percentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  max_consecutive_failures?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  healthcheck_interval_seconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consecutive_failures?: number;
}
