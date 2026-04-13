import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PillarService } from '../pillar/pillar.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

export interface CompanyHealthCheck {
  company_id: string;
  last_check_time: Date;
  failure_count: number;
  status: 'healthy' | 'unhealthy';
}

@Injectable()
export class ScheduledTasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledTasksService.name);
  private readonly healthCheckMap: Map<string, CompanyHealthCheck> = new Map();
  private readonly checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly adminService: AdminService,
    private readonly pillarService: PillarService,
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  onModuleInit() {
    this.logger.log('Initializing scheduled tasks service...');
    this.startGlobalHealthChecks();
  }

  private startGlobalHealthChecks() {
    // Run master health check every 60 seconds
    const checkInterval = setInterval(async () => {
      await this.runHealthChecks();
    }, 60000); // 60 seconds

    this.checkIntervals.set('pillar-health', checkInterval);
    this.logger.log('✅ Started Pillar health checks (every 60 seconds)');
  }

  private async runHealthChecks() {
    const supabase = this.supabaseService.getClient();

    // Get all companies
    try {
      const { data: companies, error } = await supabase.from('company').select('company_id');

      if (error) {
        this.logger.error('Failed to fetch companies for health check:', error.message);
        return;
      }

      // Check health for each company
      for (const company of companies || []) {
        await this.checkAndUpdateCompanyHealth(company.company_id);
      }
    } catch (error) {
      this.logger.error('Unexpected error in health checks:', error);
    }
  }

  private async checkAndUpdateCompanyHealth(companyId: string) {
    try {
      // Check Pillar health using the service
      const pillarHealth = await this.pillarService.checkPillarHealth();

      if (pillarHealth.healthy) {
        // Reset failure counter on successful check
        await this.adminService.resetSfiaFailureCounter(companyId, 'system');
        this.logger.debug(`✅ Pillar health check passed for company ${companyId}`);
      } else {
        // Record failure
        const result = await this.adminService.recordSfiaFailure(companyId);

        if (result.auto_disabled) {
          this.logger.warn(
            `⚠️ SFIA auto-disabled for company ${companyId} due to ${result.failure_count} consecutive Pillar failures`,
          );

          // Send alert email to admins
          await this.sendSfiaDisabledAlert(companyId, result.failure_count);
        } else {
          this.logger.warn(
            `Pillar failure #${result.failure_count}/${2} for company ${companyId}`,
          );
        }
      }

      // Update local cache
      const settings = await this.adminService.getSfiaSettings(companyId);
      this.healthCheckMap.set(companyId, {
        company_id: companyId,
        last_check_time: new Date(),
        failure_count: settings.consecutive_failures,
        status: pillarHealth.healthy ? 'healthy' : 'unhealthy',
      });
    } catch (error) {
      this.logger.error(`Error checking health for company ${companyId}:`, error);
    }
  }

  private async sendSfiaDisabledAlert(companyId: string, failureCount: number) {
    try {
      this.logger.warn(
        `🚨 SFIA Auto-Disabled Alert: Company ${companyId} - ${failureCount} consecutive Pillar failures detected`,
      );

      // Send in-app notification to all HR users in the company
      await this.notificationsService.notifyAllHRInCompany(companyId, {
        type: 'SFIA_AUTO_DISABLED',
        title: '⚠️ SFIA Ranking Auto-Disabled',
        message: `SFIA ranking has been automatically disabled after ${failureCount} consecutive Pillar service failures. Manual ranking is now active. Re-enable SFIA once the Pillar service recovers.`,
        metadata: { failure_count: failureCount, company_id: companyId },
      });

      // Best-effort email notification to company admin email if configured
      try {
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
        if (adminEmail) {
          await this.mailService.sendSfiaDisabledAlert({
            to: adminEmail,
            companyId,
            failureCount,
          });
        }
      } catch (emailErr) {
        // Email is optional — log but do not propagate
        this.logger.warn(`[SFIA Alert] Failed to send email alert: ${(emailErr as Error)?.message}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send SFIA disabled alert for company ${companyId}:`, error);
    }
  }

  async getHealthStatus(companyId: string) {
    return this.healthCheckMap.get(companyId) || null;
  }

  async getAllHealthStatus() {
    return Array.from(this.healthCheckMap.values());
  }

  async manualHealthCheck(companyId: string) {
    await this.checkAndUpdateCompanyHealth(companyId);
    return this.getHealthStatus(companyId);
  }

  onModuleDestroy() {
    // Clean up intervals on shutdown
    this.checkIntervals.forEach((interval) => clearInterval(interval));
    this.logger.log('Cleaned up scheduled tasks');
  }
}
