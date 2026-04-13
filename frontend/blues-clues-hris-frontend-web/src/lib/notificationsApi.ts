import { API_BASE_URL } from './api';
import { getAccessToken } from './authStorage';

function headers() {
  return {
    Authorization: `Bearer ${getAccessToken()}`,
    'Content-Type': 'application/json',
  };
}

export type AppNotification = {
  notification_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function getMyNotifications(): Promise<AppNotification[]> {
  const res = await fetch(`${API_BASE_URL}/notifications/me`, { headers: headers() });
  if (!res.ok) return [];
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: headers(),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: headers(),
  });
}
