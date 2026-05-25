// Notifications (Multi-Channel Router) API methods
import type { ApiFetchFn } from './types';

export function createNotificationsApi(fetchFn: ApiFetchFn) {
  return {
    async getNotificationStatus() {
      return fetchFn('/api/notifications/status');
    },

    async getNotificationRules() {
      return fetchFn('/api/notifications/rules');
    },

    async createNotificationRule(rule: Record<string, unknown>) {
      return fetchFn('/api/notifications/rules', {
        method: 'POST',
        body: JSON.stringify(rule),
      });
    },

    async toggleNotificationRule(ruleId: string) {
      return fetchFn(`/api/notifications/rules/${ruleId}/toggle`, {
        method: 'PUT',
      });
    },

    async deleteNotificationRule(ruleId: string) {
      return fetchFn(`/api/notifications/rules/${ruleId}`, {
        method: 'DELETE',
      });
    },

    async getNotificationRecipients() {
      return fetchFn('/api/notifications/recipients');
    },

    async createNotificationRecipient(
      recipient: Record<string, unknown>
    ) {
      return fetchFn('/api/notifications/recipients', {
        method: 'POST',
        body: JSON.stringify(recipient),
      });
    },

    async testNotification(data: {
      channel?: string;
      severity?: string;
      message?: string;
    }) {
      return fetchFn('/api/notifications/test', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async dispatchNotification(event: Record<string, unknown>) {
      return fetchFn('/api/notifications/dispatch', {
        method: 'POST',
        body: JSON.stringify(event),
      });
    },
  };
}
