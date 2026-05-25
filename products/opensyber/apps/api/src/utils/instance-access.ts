import { eq, and } from 'drizzle-orm';
import { instances } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * Verify that the current user/org has access to an instance.
 *
 * - Solo mode (orgId = null): checks instances.userId === userId
 * - Org mode (orgId set):     checks instances.orgId === orgId
 *
 * Returns the instance row or null.
 */
export async function verifyInstanceAccess(
  db: DrizzleD1Database<Record<string, unknown>>,
  instanceId: string,
  userId: string,
  orgId: string | null,
) {
  const condition = orgId
    ? and(eq(instances.id, instanceId), eq(instances.orgId, orgId))
    : and(eq(instances.id, instanceId), eq(instances.userId, userId));

  const [instance] = await db
    .select()
    .from(instances)
    .where(condition)
    .limit(1);

  return instance ?? null;
}

/**
 * List instances scoped to the current user or org.
 */
export async function listInstancesScoped(
  db: DrizzleD1Database<Record<string, unknown>>,
  userId: string,
  orgId: string | null,
) {
  const condition = orgId
    ? eq(instances.orgId, orgId)
    : eq(instances.userId, userId);

  return db.select().from(instances).where(condition);
}
