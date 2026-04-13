import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../audit/audit.service';
import { UpdateSfiaSettingsDto } from './dto/sfia-settings.dto';

type SfiaSettings = {
  sfia_enabled: boolean;
  exact_match_points: number;
  above_demand_points: number;
  failover_threshold_percentage: number;
  max_consecutive_failures: number;
  healthcheck_interval_seconds: number;
  consecutive_failures: number;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditService: AuditService,
  ) {}

  async getSfiaSettings(companyId: string): Promise<SfiaSettings> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('sfia_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      return this.getDefaultSfiaSettings();
    }

    return data as SfiaSettings;
  }

  async updateSfiaSettings(
    companyId: string,
    updates: UpdateSfiaSettingsDto,
    adminUserId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('sfia_settings')
      .update({
        ...updates,
        updated_at: new Date(),
        updated_by: adminUserId,
      })
      .eq('company_id', companyId)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to update SFIA settings: ${error.message}`);

    await this.auditService.log(
      `SFIA settings updated: ${Object.keys(updates).join(', ')}`,
      adminUserId,
      companyId,
    );

    return data;
  }

  async initializeSfiaSettings(companyId: string) {
    const supabase = this.supabaseService.getClient();
    const defaults = this.getDefaultSfiaSettings();

    const { data, error } = await supabase
      .from('sfia_settings')
      .insert({
        company_id: companyId,
        ...defaults,
      })
      .select()
      .single();

    if (error)
      throw new Error(`Failed to initialize SFIA settings: ${error.message}`);
    return data;
  }

  async toggleSfiaStatus(
    companyId: string,
    enabled: boolean,
    adminUserId: string,
  ) {
    return this.updateSfiaSettings(
      companyId,
      { sfia_enabled: enabled },
      adminUserId,
    );
  }

  async recordSfiaFailure(companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: currentSettings } = await supabase
      .from('sfia_settings')
      .select('consecutive_failures')
      .eq('company_id', companyId)
      .single();

    const newFailureCount = (currentSettings?.consecutive_failures || 0) + 1;
    const sfiaSettings = await this.getSfiaSettings(companyId);

    if (newFailureCount >= sfiaSettings.max_consecutive_failures) {
      await this.updateSfiaSettings(
        companyId,
        {
          sfia_enabled: false,
          consecutive_failures: newFailureCount,
        },
        'system',
      );

      await this.auditService.log(
        `SFIA auto-disabled due to ${newFailureCount} consecutive Pillar failures`,
        'system',
        companyId,
      );

      return { auto_disabled: true, failure_count: newFailureCount };
    }

    await supabase
      .from('sfia_settings')
      .update({ consecutive_failures: newFailureCount })
      .eq('company_id', companyId);

    return { auto_disabled: false, failure_count: newFailureCount };
  }

  async resetSfiaFailureCounter(companyId: string, adminUserId: string) {
    return this.updateSfiaSettings(
      companyId,
      { consecutive_failures: 0 },
      adminUserId,
    );
  }

  private getDefaultSfiaSettings(): SfiaSettings {
    return {
      sfia_enabled: true,
      exact_match_points: 3,
      above_demand_points: 1.5,
      failover_threshold_percentage: 50,
      max_consecutive_failures: 2,
      healthcheck_interval_seconds: 60,
      consecutive_failures: 0,
    };
  }
}
