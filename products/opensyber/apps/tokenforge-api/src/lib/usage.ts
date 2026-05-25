import { eq, and, sql } from 'drizzle-orm';
import { tfUsage } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';

type UsageType = 'verification' | 'bind' | 'stepUp';

/**
 * Increment daily usage counter for a tenant.
 * Uses an upsert pattern: insert if missing, update if exists.
 */
export async function incrementUsage(
  db: DrizzleD1Database<typeof schema>,
  tenantId: string,
  type: UsageType,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]!;
  const id = `${tenantId}_${today}`;

  const columnMap: Record<UsageType, string> = {
    verification: 'verification_count',
    bind: 'bind_count',
    stepUp: 'step_up_count',
  };

  const column = columnMap[type];

  // Try to find existing row
  const existing = await db
    .select()
    .from(tfUsage)
    .where(and(eq(tfUsage.tenantId, tenantId), eq(tfUsage.date, today)));

  if (existing.length > 0) {
    await db
      .update(tfUsage)
      .set(
        type === 'verification'
          ? { verificationCount: sql`${tfUsage.verificationCount} + 1` }
          : type === 'bind'
            ? { bindCount: sql`${tfUsage.bindCount} + 1` }
            : { stepUpCount: sql`${tfUsage.stepUpCount} + 1` },
      )
      .where(and(eq(tfUsage.tenantId, tenantId), eq(tfUsage.date, today)));
  } else {
    await db.insert(tfUsage).values({
      id,
      tenantId,
      date: today,
      verificationCount: type === 'verification' ? 1 : 0,
      bindCount: type === 'bind' ? 1 : 0,
      stepUpCount: type === 'stepUp' ? 1 : 0,
    });
  }
}
