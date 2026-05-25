import { createMiddleware } from 'hono/factory';
import { eq, and, sql } from 'drizzle-orm';
import { tfUsage } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { PLAN_LIMITS } from '../types.js';
import { dispatchWebhook } from '../services/webhook-dispatch.js';

/**
 * Usage limit middleware.
 * Checks the current month's total verification+bind count against plan limits.
 * Returns 429 if usage exceeds 110% of the plan limit (hard cap).
 * Adds X-Usage-Remaining header.
 */
export const usageLimit = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const tenantId = c.get('tenantId');
  const plan = c.get('tenantPlan');
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS['free']!;

  // Enterprise has unlimited usage
  if (limit === Infinity) {
    c.header('X-Usage-Remaining', 'unlimited');
    await next();
    return;
  }

  const db = c.get('db');
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(Date.UTC(y, m + 1, 1));
  const monthEnd = nextMonthDate.toISOString().split('T')[0]!;

  const rows = await db
    .select({
      totalVerifications: sql<number>`COALESCE(SUM(${tfUsage.verificationCount}), 0)`,
      totalBinds: sql<number>`COALESCE(SUM(${tfUsage.bindCount}), 0)`,
    })
    .from(tfUsage)
    .where(
      and(
        eq(tfUsage.tenantId, tenantId),
        sql`${tfUsage.date} >= ${monthStart}`,
        sql`${tfUsage.date} < ${monthEnd}`,
      ),
    );

  const row = rows[0];
  const totalUsage = (row?.totalVerifications ?? 0) + (row?.totalBinds ?? 0);
  const hardCap = Math.ceil(limit * 1.1);

  if (totalUsage >= hardCap) {
    // Security telemetry must escape the billing gate. Subscribers learn that
    // their tenant is being throttled — without this they go silent at the cap
    // and miss visibility into ongoing verify pressure (incl. attack traffic).
    c.executionCtx.waitUntil(
      dispatchWebhook(db, tenantId, 'usage.cap_exceeded', {
        plan,
        limit,
        hardCap,
        totalUsage,
        path: c.req.path,
        method: c.req.method,
      }),
    );
    return c.json(
      {
        error: 'rate_limit_exceeded',
        message: 'Monthly usage limit exceeded',
      },
      429,
    );
  }

  const remaining = Math.max(0, limit - totalUsage);
  c.header('X-Usage-Remaining', String(remaining));

  await next();
});
