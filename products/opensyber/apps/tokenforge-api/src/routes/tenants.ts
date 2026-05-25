import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { tfTenants, tfUsage } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { PLAN_LIMITS } from '../types.js';
import { tenantKeyRoutes } from './tenant-keys.js';

export const tenantRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Mount API key sub-routes
tenantRoutes.route('/', tenantKeyRoutes);

/** GET /v1/tenant — current tenant info with usage summary */
tenantRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const plan = c.get('tenantPlan');

  const [tenant] = await db
    .select()
    .from(tfTenants)
    .where(eq(tfTenants.id, tenantId));

  if (!tenant) {
    return c.json({ error: 'not_found', message: 'Tenant not found' }, 404);
  }

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(Date.UTC(y, m + 1, 1));
  const monthEnd = nextMonth.toISOString().split('T')[0]!;

  const [usageRow] = await db
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

  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS['free']!;
  const totalUsage = (usageRow?.totalVerifications ?? 0) + (usageRow?.totalBinds ?? 0);

  return c.json({
    data: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      subscription: {
        customerId: tenant.lemonSqueezyCustomerId,
        subscriptionId: tenant.lemonSqueezySubscriptionId,
      },
      usage: {
        total: totalUsage,
        limit: limit === Infinity ? 'unlimited' : limit,
        remaining: limit === Infinity ? 'unlimited' : Math.max(0, limit - totalUsage),
      },
      createdAt: tenant.createdAt,
    },
  });
});
