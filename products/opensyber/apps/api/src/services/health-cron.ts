import { eq, and } from 'drizzle-orm';
import { instances, notificationChannels } from '@opensyber/db';
import type { Env } from '../types.js';
import { agentRuntime } from './agent-runtime.js';
import { notificationService } from './notifications.js';
import { recordCheck } from './uptime.js';
import { createDb } from '../lib/db.js';

/**
 * Polls Cloudflare Containers for status and updates instance records.
 * On error/stopped: notifies user, attempts auto-restart.
 * Runs every 5 minutes via cron trigger.
 */
export async function pollInstanceHealth(env: Env): Promise<void> {
  const db = createDb(env.DB);

  const activeInstances = await db
    .select()
    .from(instances)
    .where(eq(instances.status, 'ready'));

  const runningInstances = await db
    .select()
    .from(instances)
    .where(eq(instances.status, 'running'));

  const allInstances = [...activeInstances, ...runningInstances];

  for (const instance of allInstances) {
    if (!instance.containerId) continue;

    try {
      const status = await agentRuntime.getInstanceStatus({
        containerId: instance.containerId,
        doNamespace: env.AGENT_DO,
      });

      if (status === 'error' || status === 'stopped') {
        await db
          .update(instances)
          .set({
            status: 'error',
            lastHealthCheck: new Date().toISOString(),
          })
          .where(eq(instances.id, instance.id));

        await recordCheck(db as any, instance.id, 'down', null, 'health');

        console.warn(
          `[HealthCron] Instance ${instance.id} is ${status}`,
        );

        await notifyInstanceDown(db, instance, status, env);
        await attemptRestart(instance, env);
      } else {
        await db
          .update(instances)
          .set({
            status: 'running',
            lastHealthCheck: new Date().toISOString(),
          })
          .where(eq(instances.id, instance.id));

        await recordCheck(db as any, instance.id, 'up', null, 'health');
      }
    } catch (err) {
      console.error(
        `[HealthCron] Failed to check instance ${instance.id}:`,
        err,
      );
    }
  }
}

async function notifyInstanceDown(
  db: ReturnType<typeof createDb>,
  instance: { id: string; userId: string; name: string | null },
  status: string,
  env: Env,
): Promise<void> {
  try {
    const channels = await db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.userId, instance.userId),
          eq(notificationChannels.isActive, true),
        ),
      );

    const payload = {
      title: 'Agent Disconnected',
      message: `Instance "${instance.name || instance.id}" is `
        + `${status}. Auto-restart attempted.`,
      severity: 'critical',
      instanceId: instance.id,
      alertId: `health-${instance.id}-${Date.now()}`,
    };

    for (const channel of channels) {
      await notificationService.notify(
        channel.channelType,
        channel.config,
        payload,
        { RESEND_API_KEY: env.RESEND_API_KEY },
      );
    }
  } catch (err) {
    console.error(
      `[HealthCron] Failed to notify for ${instance.id}:`,
      err,
    );
  }
}

async function attemptRestart(
  instance: { id: string; containerId: string | null },
  env: Env,
): Promise<void> {
  if (!instance.containerId) return;
  try {
    await agentRuntime.restartInstance({
      containerId: instance.containerId,
      doNamespace: env.AGENT_DO,
    });
    console.info(
      `[HealthCron] Auto-restart sent for instance ${instance.id}`,
    );
  } catch (err) {
    console.error(
      `[HealthCron] Auto-restart failed for ${instance.id}:`,
      err,
    );
  }
}
