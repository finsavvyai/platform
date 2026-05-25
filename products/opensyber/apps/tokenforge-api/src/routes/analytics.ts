import { Hono } from 'hono';
import { sql, eq } from 'drizzle-orm';
import { tfTenants, tfUsage, deviceSessions } from '@opensyber/db';
import type { Env, Variables } from '../types.js';

export const analyticsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * GET /v1/analytics/overview — platform-wide stats for the tenant.
 * Shows their usage trends, security posture, and growth.
 */
analyticsRoutes.get('/overview', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const now = new Date();
  // UTC-anchored to avoid TZ drift on the .toISOString() boundary —
  // same fix as compliance.ts. Local-month math resolves to YYYY-MM-30T21:00Z
  // in TZ+03:00 envs, silently dropping the last day of the period.
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const prev = new Date(Date.UTC(y, m - 1, 1));
  const prevStart = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-01`;

  // Current month usage
  const [currentUsage] = await db
    .select({
      verifications: sql<number>`COALESCE(SUM(${tfUsage.verificationCount}), 0)`,
      binds: sql<number>`COALESCE(SUM(${tfUsage.bindCount}), 0)`,
    })
    .from(tfUsage)
    .where(sql`${tfUsage.tenantId} = ${tenantId} AND ${tfUsage.date} >= ${monthStart}`);

  // Previous month usage
  const [prevUsage] = await db
    .select({
      verifications: sql<number>`COALESCE(SUM(${tfUsage.verificationCount}), 0)`,
      binds: sql<number>`COALESCE(SUM(${tfUsage.bindCount}), 0)`,
    })
    .from(tfUsage)
    .where(sql`${tfUsage.tenantId} = ${tenantId} AND ${tfUsage.date} >= ${prevStart} AND ${tfUsage.date} < ${monthStart}`);

  // Active sessions
  const [sessions] = await db
    .select({
      active: sql<number>`COUNT(CASE WHEN revoked = 0 THEN 1 END)`,
      revoked: sql<number>`COUNT(CASE WHEN revoked = 1 THEN 1 END)`,
      total: sql<number>`COUNT(*)`,
    })
    .from(deviceSessions)
    .where(eq(deviceSessions.tenantId, tenantId));

  // Average trust score
  const [trustAvg] = await db
    .select({
      avg: sql<number>`COALESCE(AVG(${deviceSessions.trustScore}), 0)`,
    })
    .from(deviceSessions)
    .where(sql`${deviceSessions.tenantId} = ${tenantId} AND ${deviceSessions.revoked} = 0`);

  // Daily usage for last 30 days
  const dailyUsage = await db
    .select({
      date: tfUsage.date,
      verifications: tfUsage.verificationCount,
      binds: tfUsage.bindCount,
    })
    .from(tfUsage)
    .where(sql`${tfUsage.tenantId} = ${tenantId} AND ${tfUsage.date} >= date('now', '-30 days')`)
    .orderBy(tfUsage.date);

  const currentTotal = (currentUsage?.verifications ?? 0) + (currentUsage?.binds ?? 0);
  const prevTotal = (prevUsage?.verifications ?? 0) + (prevUsage?.binds ?? 0);
  const growthPercent = prevTotal > 0
    ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100)
    : currentTotal > 0 ? 100 : 0;

  return c.json({
    data: {
      period: { start: monthStart, end: now.toISOString().split('T')[0] },
      usage: {
        current: currentTotal,
        previous: prevTotal,
        growthPercent,
        verifications: currentUsage?.verifications ?? 0,
        binds: currentUsage?.binds ?? 0,
      },
      sessions: {
        active: sessions?.active ?? 0,
        revoked: sessions?.revoked ?? 0,
        total: sessions?.total ?? 0,
      },
      trustScore: {
        average: Math.round(trustAvg?.avg ?? 0),
      },
      dailyUsage: dailyUsage.map((d) => ({
        date: d.date,
        total: (d.verifications ?? 0) + (d.binds ?? 0),
      })),
    },
  });
});
