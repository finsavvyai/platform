import { Hono } from 'hono';
import { sql, desc } from 'drizzle-orm';
import { users } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { adminMiddleware } from '../middleware/admin.js';

const adminBillingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminBillingRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);

// GET /api/admin/billing — revenue overview
adminBillingRoutes.get('/', async (c) => {
  const db = c.get('db');

  // Plan distribution
  const planCounts = await db
    .select({ plan: users.plan, count: sql<number>`count(*)` })
    .from(users)
    .groupBy(users.plan);

  const distribution: Record<string, number> = {};
  for (const row of planCounts) {
    distribution[row.plan] = row.count;
  }

  // Estimate MRR based on plan pricing
  const planPricing: Record<string, number> = {
    free: 0,
    personal: 29,
    pro: 149,
    team: 399,
  };

  let mrr = 0;
  for (const row of planCounts) {
    mrr += (planPricing[row.plan] ?? 0) * row.count;
  }

  // Recent subscriptions (users with subscription IDs, ordered by creation)
  const recentSubs = await db.select({
    id: users.id,
    email: users.email,
    plan: users.plan,
    createdAt: users.createdAt,
  }).from(users)
    .where(sql`${users.lemonSqueezySubscriptionId} IS NOT NULL`)
    .orderBy(desc(users.createdAt))
    .limit(20);

  return c.json({
    data: {
      mrr,
      planDistribution: distribution,
      recentSubscriptions: recentSubs,
    },
  });
});

export { adminBillingRoutes };
