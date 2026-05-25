/**
 * Individual cron job implementations: token rotation reminders
 * and activity retention purge.
 */

import { eq, and, lt } from 'drizzle-orm';
import { instances, users, agentActivity } from '@opensyber/db';
import type { Env } from '../types.js';
import { createDb } from '../lib/db.js';
import { PLAN_CONFIGS, type Plan } from '@opensyber/shared';

/**
 * Warn users whose gateway tokens are > 90 days old.
 */
export async function sendGatewayTokenRotationReminders(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const oldInstances = await db
    .select({
      instanceId: instances.id, instanceName: instances.name,
      userId: instances.userId, email: users.email, userName: users.name,
    })
    .from(instances)
    .innerJoin(users, eq(instances.userId, users.id))
    .where(and(lt(instances.createdAt, ninetyDaysAgo), eq(instances.status, 'running')))
    .limit(100);

  for (const inst of oldInstances) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'OpenSyber Security <security@opensyber.cloud>',
          to: inst.email,
          subject: `Security Reminder: Rotate gateway token for "${inst.instanceName}"`,
          html: `<p>Hi ${inst.userName || 'there'},</p>
<p>Your instance <strong>${inst.instanceName}</strong> has been running for over 90 days. We recommend rotating your gateway token for security best practices.</p>
<p><a href="https://opensyber.cloud/dashboard">Go to Dashboard</a></p>`,
        }),
      });
    } catch (err) {
      console.error(`[CronHandlers] Failed to send rotation reminder for ${inst.instanceId}:`, err);
    }
  }
}

/**
 * Purge expired agent activity records based on user's plan tier.
 */
export async function purgeExpiredActivity(env: Env): Promise<void> {
  try {
    const db = createDb(env.DB);
    const userIds = await db.selectDistinct({ userId: agentActivity.userId }).from(agentActivity).limit(1000);
    let totalDeleted = 0;

    for (const { userId } of userIds) {
      try {
        const [user] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId)).limit(1);
        if (!user) continue;

        const plan = user.plan as Plan;
        const config = PLAN_CONFIGS[plan];
        const retentionDays = config?.agentHistoryDays ?? 7;
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

        await db.delete(agentActivity).where(and(eq(agentActivity.userId, userId), lt(agentActivity.createdAt, cutoffDate)));
        totalDeleted++;
      } catch (err) {
        console.error(`[CronHandlers] Failed to purge activity for user ${userId}:`, err);
      }
    }

    if (totalDeleted > 0) {
      console.log(`[CronHandlers] Purged ${totalDeleted} expired activity records`);
    }
  } catch (error) {
    console.error('[CronHandlers] Failed to purge expired activity:', error);
  }
}
