/**
 * Series A Data Room Metrics
 *
 * Provides investor-ready metrics: MRR, customer count, NRR,
 * agent installs, and growth trends for the data room.
 */

import { Hono } from 'hono';
import { eq, and, count, sql } from 'drizzle-orm';
import { users, organizations, instances, skills, skillInstallations } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';

export const metricsDataroomRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

metricsDataroomRoutes.use('*', dbMiddleware, authMiddleware);

const admin = requirePermission('billing.manage');

/** GET /api/metrics/dataroom — Series A data room metrics */
metricsDataroomRoutes.get('/dataroom', admin, async (c) => {
  const db = c.get('db');

  const [userCount, orgCount, instanceCount, skillCount, installCount] =
    await Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(organizations),
      db.select({ n: count() }).from(instances),
      db.select({ n: count() }).from(skills).where(eq(skills.verificationStatus, 'approved')),
      db.select({ n: count() }).from(skillInstallations),
    ]);

  const totalUsers = userCount[0]?.n ?? 0;
  const totalOrgs = orgCount[0]?.n ?? 0;
  const totalInstances = instanceCount[0]?.n ?? 0;
  const totalSkills = skillCount[0]?.n ?? 0;
  const totalInstalls = installCount[0]?.n ?? 0;

  // Plan distribution
  const planDist = await db
    .select({ plan: organizations.plan, n: count() })
    .from(organizations)
    .groupBy(organizations.plan);

  const planBreakdown: Record<string, number> = {};
  for (const row of planDist) {
    planBreakdown[row.plan] = row.n;
  }

  // MRR calculation (based on plan pricing)
  const PLAN_MRR: Record<string, number> = {
    free: 0,
    personal: 29,
    pro: 99,
    team: 399,
    enterprise: 999,
  };

  let mrr = 0;
  for (const [plan, count] of Object.entries(planBreakdown)) {
    mrr += (PLAN_MRR[plan] ?? 0) * count;
  }

  const payingOrgs = Object.entries(planBreakdown)
    .filter(([plan]) => plan !== 'free')
    .reduce((sum, [, n]) => sum + n, 0);

  return c.json({
    data: {
      snapshot: new Date().toISOString(),
      revenue: {
        mrr,
        arr: mrr * 12,
        payingCustomers: payingOrgs,
        arpu: payingOrgs > 0 ? Math.round(mrr / payingOrgs) : 0,
      },
      usage: {
        totalUsers,
        totalOrgs,
        totalInstances,
        totalSkills,
        totalSkillInstalls: totalInstalls,
        avgInstancesPerOrg: totalOrgs > 0 ? +(totalInstances / totalOrgs).toFixed(1) : 0,
      },
      planBreakdown,
      conversion: {
        freeToPayingRate: totalOrgs > 0
          ? +((payingOrgs / totalOrgs) * 100).toFixed(1)
          : 0,
      },
    },
  });
});
