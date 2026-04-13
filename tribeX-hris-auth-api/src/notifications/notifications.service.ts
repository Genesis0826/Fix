import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async createNotification(dto: {
    userId: string;
    companyId: string;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('user_notifications')
      .insert({
        user_id: dto.userId,
        company_id: dto.companyId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        metadata: dto.metadata ?? null,
      });

    if (error) {
      this.logger.error('[NotificationsService] Failed to create notification:', error.message);
    }
  }

  async notifyAllHRInCompany(
    companyId: string,
    payload: {
      type: string;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const { data: hrUsers, error } = await this.supabaseService
      .getClient()
      .from('user_profile')
      .select('user_id, role:role_id(role_name)')
      .eq('company_id', companyId);

    if (error) {
      this.logger.error('[NotificationsService] Failed to fetch HR users:', error.message);
      return;
    }

    const HR_ROLES = ['HR Officer', 'HR Recruiter', 'Admin', 'System Admin'];
    const targets = (hrUsers ?? []).filter((u: any) => HR_ROLES.includes(u.role?.role_name));

    for (const user of targets) {
      await this.createNotification({ userId: user.user_id, companyId, ...payload });
    }
  }

  async getForUser(userId: string, limit = 30) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('[NotificationsService] Failed to fetch notifications:', error.message);
      return [];
    }
    return data ?? [];
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('user_notifications')
      .update({ is_read: true })
      .eq('notification_id', notificationId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error('[NotificationsService] Failed to mark notification read:', error.message);
    }
  }

  async markAllRead(userId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      this.logger.error('[NotificationsService] Failed to mark all notifications read:', error.message);
    }
  }
}
