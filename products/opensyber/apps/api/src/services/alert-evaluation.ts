import { eq, and, gte } from 'drizzle-orm';
import {
  securityEvents, alertRules, alerts, instances,
  notificationChannels,
} from '@opensyber/db';
import type { Env } from '../types.js';
import { notificationService } from './notifications.js';

export async function evaluateAlerts(
  db: any,
  instanceId: string,
  incomingEvents: Array<{ eventType: string; severity: string }>,
  env: Env,
): Promise<void> {
  const rules = await db.select().from(alertRules)
    .where(and(eq(alertRules.instanceId, instanceId), eq(alertRules.isActive, true)));

  if (rules.length === 0) return;

  for (const rule of rules) {
    const matchingEvents = incomingEvents.filter((e) => {
      if (rule.eventType !== '*' && e.eventType !== rule.eventType) return false;
      if (rule.severityFilter && e.severity !== rule.severityFilter) return false;
      return true;
    });

    if (matchingEvents.length === 0) continue;

    const windowStart = new Date(Date.now() - rule.windowMinutes * 60 * 1000).toISOString();
    const recentEvents = await db.select().from(securityEvents)
      .where(and(
        eq(securityEvents.instanceId, instanceId),
        gte(securityEvents.createdAt, windowStart),
      ));

    const matchingRecent = recentEvents.filter((e: any) => {
      if (rule.eventType !== '*' && e.eventType !== rule.eventType) return false;
      if (rule.severityFilter && e.severity !== rule.severityFilter) return false;
      return true;
    });

    if (matchingRecent.length < rule.threshold) continue;

    const cooldownStart = new Date(Date.now() - rule.cooldownMinutes * 60 * 1000).toISOString();
    const recentAlerts = await db.select().from(alerts)
      .where(and(eq(alerts.alertRuleId, rule.id), gte(alerts.createdAt, cooldownStart)));

    if (recentAlerts.length > 0) continue;

    const maxSeverity = matchingEvents.reduce((max: string, e) => {
      if (e.severity === 'critical') return 'critical';
      if (e.severity === 'warning' && max !== 'critical') return 'warning';
      return max;
    }, 'info');

    const alertId = crypto.randomUUID();
    await db.insert(alerts).values({
      id: alertId,
      instanceId,
      alertRuleId: rule.id,
      severity: maxSeverity as typeof alerts.$inferInsert.severity,
      title: `${rule.name}: ${matchingRecent.length} events in ${rule.windowMinutes}m`,
      details: JSON.stringify({ eventCount: matchingRecent.length, rule: rule.name }),
      status: 'open',
      triggeredCount: matchingRecent.length,
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
      resolvedAt: null,
    });

    try {
      const [inst] = await db.select().from(instances).where(eq(instances.id, instanceId));
      if (inst) {
        const channels = await db.select().from(notificationChannels)
          .where(and(eq(notificationChannels.userId, inst.userId), eq(notificationChannels.isActive, true)));

        for (const ch of channels) {
          await notificationService.notify(ch.channelType, ch.config, {
            title: rule.name,
            message: `${matchingRecent.length} ${rule.eventType} events detected in ${rule.windowMinutes} minutes`,
            severity: maxSeverity,
            instanceId,
            alertId,
          }, env);
        }
      }
    } catch (err) {
      console.error('[Notifications] Error sending alert notifications:', err);
    }
  }
}
