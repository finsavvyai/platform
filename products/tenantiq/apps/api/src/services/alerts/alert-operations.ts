import { nanoid } from 'nanoid';
import type { Alert } from './types.js';
import { alerts, alertHistory } from './store.js';

export async function createAlert(
  data: Omit<Alert, 'id' | 'createdAt'>
): Promise<Alert> {
  const alert: Alert = {
    id: nanoid(),
    ...data,
    createdAt: new Date()
  };

  if (!alerts.has(data.tenantId)) {
    alerts.set(data.tenantId, []);
  }

  alerts.get(data.tenantId)!.push(alert);

  if (!alertHistory.has(data.tenantId)) {
    alertHistory.set(data.tenantId, []);
  }
  alertHistory.get(data.tenantId)!.push(alert);

  return alert;
}

export async function getAlerts(
  tenantId: string,
  options?: { severity?: string; resolved?: boolean }
): Promise<Alert[]> {
  let result = alerts.get(tenantId) || [];

  if (options?.severity) {
    result = result.filter(a => a.severity === options.severity);
  }

  if (options?.resolved !== undefined) {
    result = result.filter(
      a => (a.resolvedAt !== undefined) === options.resolved
    );
  }

  return result;
}

export async function acknowledgeAlert(
  alertId: string,
  userId: string
): Promise<Alert | null> {
  for (const [, alerts_] of alerts) {
    const alert = alerts_.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      return alert;
    }
  }
  return null;
}

export async function resolveAlert(alertId: string): Promise<Alert | null> {
  for (const [, alerts_] of alerts) {
    const alert = alerts_.find(a => a.id === alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      return alert;
    }
  }
  return null;
}

export async function bulkResolveAlerts(
  tenantId: string,
  severity?: string
): Promise<number> {
  const alerts_ = alerts.get(tenantId) || [];
  let resolved = 0;

  for (const alert of alerts_) {
    if (!alert.resolvedAt && (!severity || alert.severity === severity)) {
      alert.resolvedAt = new Date();
      resolved++;
    }
  }

  return resolved;
}

export async function getAlertStatistics(
  tenantId: string,
  options?: { days?: number }
): Promise<{
  total: number;
  byseverity: Record<string, number>;
  acknowledged: number;
  resolved: number;
  active: number;
}> {
  const days = options?.days || 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const relevant = (alertHistory.get(tenantId) || []).filter(
    a => a.createdAt >= cutoff
  );

  const byS: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  for (const alert of relevant) {
    byS[alert.severity]++;
  }

  return {
    total: relevant.length,
    byseverity: byS,
    acknowledged: relevant.filter(a => a.acknowledged).length,
    resolved: relevant.filter(a => a.resolvedAt).length,
    active: relevant.filter(a => !a.resolvedAt).length
  };
}

export async function getAlertHistory(
  tenantId: string,
  options?: { limit?: number; offset?: number }
): Promise<Alert[]> {
  let history = alertHistory.get(tenantId) || [];
  history = history.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const offset = options?.offset || 0;
  const limit = options?.limit || 50;

  return history.slice(offset, offset + limit);
}

export async function sendAlertNotification(
  alert: Alert,
  channels: Array<{ type: 'email' | 'slack' | 'webhook'; target: string }>
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const channel of channels) {
    try {
      switch (channel.type) {
        case 'email':
          success++;
          break;
        case 'slack':
          success++;
          break;
        case 'webhook':
          success++;
          break;
      }
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

export async function getRecommendations(
  tenantId: string
): Promise<Array<{ severity: string; title: string; action: string }>> {
  const alerts_ = await getAlerts(tenantId, { resolved: false });
  return alerts_.map(a => ({
    severity: a.severity,
    title: a.title,
    action: `Address ${a.component} issue to improve health score`
  }));
}
