import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import {
  enterpriseLeads,
  instances,
  organizations,
  securityEvents,
  trustFunnelEvents,
  users,
} from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { adminMiddleware } from '../middleware/admin.js';

const adminStatsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminStatsRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);

// GET /api/admin/stats — platform-wide statistics
adminStatsRoutes.get('/', async (c) => {
  const db = c.get('db');

  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [instanceCount] = await db.select({ count: sql<number>`count(*)` }).from(instances);
  const [orgCount] = await db.select({ count: sql<number>`count(*)` }).from(organizations);
  const [eventCount] = await db.select({ count: sql<number>`count(*)` }).from(securityEvents);
  const [activeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(instances)
    .where(eq(instances.status, 'running'));
  const [leadCount] = await db.select({ count: sql<number>`count(*)` }).from(enterpriseLeads);
  const [recentLeadCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enterpriseLeads)
    .where(sql`${enterpriseLeads.createdAt} >= datetime('now', '-7 days')`);
  const [trustViewCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trustFunnelEvents)
    .where(eq(trustFunnelEvents.event, 'trust_page_view'));
  const [recentTrustViewCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trustFunnelEvents)
    .where(sql`${trustFunnelEvents.event} = 'trust_page_view' and ${trustFunnelEvents.createdAt} >= datetime('now', '-7 days')`);
  const [trialStartCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trustFunnelEvents)
    .where(eq(trustFunnelEvents.event, 'trust_start_trial'));
  const [signupViewCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trustFunnelEvents)
    .where(eq(trustFunnelEvents.event, 'trust_sign_up_view'));
  const [demoRequestCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trustFunnelEvents)
    .where(eq(trustFunnelEvents.event, 'trust_enterprise_submit'));
  const topSources = await db
    .select({
      source: trustFunnelEvents.source,
      count: sql<number>`count(*)`,
    })
    .from(trustFunnelEvents)
    .where(sql`${trustFunnelEvents.source} is not null`)
    .groupBy(trustFunnelEvents.source)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  return c.json({
    data: {
      totalUsers: userCount?.count ?? 0,
      totalInstances: instanceCount?.count ?? 0,
      totalOrgs: orgCount?.count ?? 0,
      totalEvents: eventCount?.count ?? 0,
      activeInstances: activeCount?.count ?? 0,
      trustFunnel: {
        totalLeads: leadCount?.count ?? 0,
        recentLeads7d: recentLeadCount?.count ?? 0,
        trustPageViews: trustViewCount?.count ?? 0,
        recentViews7d: recentTrustViewCount?.count ?? 0,
        trustTrialStarts: trialStartCount?.count ?? 0,
        trustSignupViews: signupViewCount?.count ?? 0,
        trustDemoRequests: demoRequestCount?.count ?? 0,
        topSources: topSources
          .filter((row) => typeof row.source === 'string' && row.source.length > 0)
          .map((row) => ({ source: row.source as string, count: row.count ?? 0 })),
      },
    },
  });
});

export { adminStatsRoutes };
