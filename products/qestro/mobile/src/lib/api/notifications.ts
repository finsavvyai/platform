import { apiFetch } from './client';
import type { ApiResponse, NotificationRule } from '../../types';

export async function getNotificationStatus(): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/notifications/status');
}

export async function getNotificationRules(): Promise<ApiResponse<NotificationRule[]>> {
  return apiFetch('/api/notifications/rules');
}

export async function createNotificationRule(
  data: Omit<NotificationRule, 'id'>,
): Promise<ApiResponse<NotificationRule>> {
  return apiFetch('/api/notifications/rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function toggleNotificationRule(
  id: string,
): Promise<ApiResponse<void>> {
  return apiFetch(`/api/notifications/rules/${id}/toggle`, { method: 'PUT' });
}

export async function deleteNotificationRule(
  id: string,
): Promise<ApiResponse<void>> {
  return apiFetch(`/api/notifications/rules/${id}`, { method: 'DELETE' });
}

export async function testNotification(data: {
  channel: string;
  recipient: string;
}): Promise<ApiResponse<void>> {
  return apiFetch('/api/notifications/test', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
