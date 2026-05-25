import { Hono } from 'hono';
import { eq, and, sql, desc } from 'drizzle-orm';
import { tfUsage } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { PLAN_LIMITS } from '../types.js';

export const usageRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/** GET /v1/usage — usage stats for current billing period */
usageRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const plan = c.get('tenantPlan');

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
      totalStepUps: sql<number>`COALESCE(SUM(${tfUsage.stepUpCount}), 0)`,
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
  const verifications = row?.totalVerifications ?? 0;
  const binds = row?.totalBinds ?? 0;
  const stepUps = row?.totalStepUps ?? 0;
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS['free']!;

  return c.json({
    data: {
      plan,
      periodStart: monthStart,
      periodEnd: monthEnd,
      verifications,
      binds,
      stepUps,
      total: verifications + binds,
      limit: limit === Infinity ? 'unlimited' : limit,
      remaining: limit === Infinity ? 'unlimited' : Math.max(0, limit - (verifications + binds)),
    },
  });
});

/** GET /v1/usage/daily — daily breakdown for last 30 days */
usageRoutes.get('/daily', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0]!;

  const rows = await db
    .select({
      date: tfUsage.date,
      verifications: tfUsage.verificationCount,
      binds: tfUsage.bindCount,
      stepUps: tfUsage.stepUpCount,
    })
    .from(tfUsage)
    .where(
      and(
        eq(tfUsage.tenantId, tenantId),
        sql`${tfUsage.date} >= ${startDate}`,
      ),
    )
    .orderBy(desc(tfUsage.date));

  return c.json({ data: rows });
});
