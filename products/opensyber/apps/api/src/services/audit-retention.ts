import { eq, and, lt } from 'drizzle-orm';
import { auditLog, instances, users } from '@opensyber/db';
import type { Plan } from '@opensyber/shared';
import type { Env } from '../types.js';
import { createDb } from '../lib/db.js';

const RETENTION_DAYS: Record<Plan, number> = {
  free: 3,
  personal: 7,
  pro: 90,
  team: 365,
  professional: 365,
  enterprise: 730,
  mission_defender: 730,
};

/**
 * Delete audit_log entries older than the plan-specific retention period.
 * Runs per-plan to respect different retention policies.
 */
export async function enforceAuditRetention(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  let totalDeleted = 0;

  for (const [plan, days] of Object.entries(RETENTION_DAYS)) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Find instances belonging to users on this plan
    const planInstances = await db
      .select({ id: instances.id })
      .from(instances)
      .innerJoin(users, eq(instances.userId, users.id))
      .where(eq(users.plan, plan as 'free' | 'personal' | 'pro' | 'team'));

    if (planInstances.length === 0) continue;

    const instanceIds = planInstances.map((i: { id: string }) => i.id);

    // Delete in batches to avoid large transactions
    for (const instanceId of instanceIds) {
      const result = await db.delete(auditLog).where(
        and(
          eq(auditLog.instanceId, instanceId),
          lt(auditLog.createdAt, cutoff),
        ),
      ) as unknown as { changes?: number };
      totalDeleted += result?.changes ?? 0;
    }
  }

  return { deleted: totalDeleted };
}

/** Get retention days for a given plan. */
export function getRetentionDays(plan: Plan): number {
  return RETENTION_DAYS[plan];
}
