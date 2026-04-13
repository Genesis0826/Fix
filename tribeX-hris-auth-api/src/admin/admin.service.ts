import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
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

    if (error) throw new Error(`Failed to update SFIA settings: ${error.message}`);

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

    if (error) throw new Error(`Failed to initialize SFIA settings: ${error.message}`);
    return data;
  }

  async toggleSfiaStatus(companyId: string, enabled: boolean, adminUserId: string) {
    return this.updateSfiaSettings(companyId, { sfia_enabled: enabled }, adminUserId);
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

      // Record health check entry
      try {
        await supabase.from('sfia_health_checks').insert({
          company_id: companyId,
          pillar_status: 'unhealthy',
          failure_count: newFailureCount,
          sfia_action: 'auto_disabled',
        });
      } catch { /* non-fatal */ }

      // Notify all HR Recruiters in the company via in-app and email
      await this.notifyHrRecruitersOfSfiaFallback(companyId, `SFIA auto-disabled after ${newFailureCount} consecutive Pillar API failures. Please rank candidates manually.`);

      return { auto_disabled: true, failure_count: newFailureCount };
    }

    await supabase
      .from('sfia_settings')
      .update({ consecutive_failures: newFailureCount })
      .eq('company_id', companyId);

    // Record health check entry
    try {
      await supabase.from('sfia_health_checks').insert({
        company_id: companyId,
        pillar_status: 'unhealthy',
        failure_count: newFailureCount,
        sfia_action: 'no_action',
      });
    } catch { /* non-fatal */ }

    return { auto_disabled: false, failure_count: newFailureCount };
  }

  async resetSfiaFailureCounter(companyId: string, adminUserId: string) {
    const result = await this.updateSfiaSettings(
      companyId,
      { consecutive_failures: 0 },
      adminUserId,
    );

    // Record health check recovery
    try {
      await this.supabaseService.getClient().from('sfia_health_checks').insert({
        company_id: companyId,
        pillar_status: 'healthy',
        failure_count: 0,
        sfia_action: 'auto_enabled',
      });
    } catch { /* non-fatal */ }

    return result;
  }

  private async notifyHrRecruitersOfSfiaFallback(companyId: string, reason: string, jobTitle?: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('company_id', companyId)
      .maybeSingle();

    const { data: hrUsers } = await supabase
      .from('user_profile')
      .select('user_id, first_name, last_name, email, role:role_id(role_name)')
      .eq('company_id', companyId);

    const HR_RECRUITER_ROLES = ['HR Recruiter', 'Admin', 'System Admin'];
    const recruiters = (hrUsers ?? []).filter((u: any) =>
      HR_RECRUITER_ROLES.includes(u.role?.role_name),
    );

    for (const recruiter of recruiters) {
      // In-app notification
      this.notificationsService.createNotification({
        userId: recruiter.user_id,
        companyId,
        type: 'SFIA_FALLBACK',
        title: '⚠️ SFIA Ranking Fallback Activated',
        message: reason,
        metadata: { job_title: jobTitle },
      }).catch(() => {});

      // Email notification
      if (recruiter.email) {
        this.mailService.sendSfiaFallbackNotificationEmail({
          to: recruiter.email,
          recruiterName: `${recruiter.first_name ?? ''} ${recruiter.last_name ?? ''}`.trim() || 'HR Recruiter',
          companyName: company?.company_name ?? 'your company',
          reason,
          jobTitle,
        }).catch(() => {});
      }
    }
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
