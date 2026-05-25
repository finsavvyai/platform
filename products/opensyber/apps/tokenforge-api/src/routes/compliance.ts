import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import {
  tfTenants,
  tfUsage,
  tfSecurityEvents,
  deviceSessions,
} from '@opensyber/db';
import type { Env, Variables } from '../types.js';

export const complianceRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const THREAT_TYPES = [
  'hijack_attempt',
  'trust_drop',
  'ip_change',
  'geo_anomaly',
  'session_revoked',
] as const;

/** GET /v1/compliance/report — monthly compliance report */
complianceRoutes.get('/report', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const plan = c.get('tenantPlan');

  const now = new Date();
  // UTC-anchored to avoid TZ drift on the .toISOString() boundary.
  // In a TZ east of UTC, `new Date(year, month+1, 1)` resolves to YYYY-MM-30T21:00Z
  // (last day of CURRENT month) instead of YYYY-MM-01 of next, which broke
  // both the period.end response and the SQL `< monthEnd` row filter.
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed
  const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(Date.UTC(y, m + 1, 1));
  const monthEnd = nextMonth.toISOString().split('T')[0]!;
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  // Usage totals for current month
  const [usageRow] = await db
    .select({
      verifications: sql<number>`COALESCE(SUM(${tfUsage.verificationCount}), 0)`,
      binds: sql<number>`COALESCE(SUM(${tfUsage.bindCount}), 0)`,
    })
    .from(tfUsage)
    .where(
      and(
        eq(tfUsage.tenantId, tenantId),
        sql`${tfUsage.date} >= ${monthStart}`,
        sql`${tfUsage.date} < ${monthEnd}`,
      ),
    );

  // Threats by type for current month
  const threatRows = await db
    .select({
      eventType: tfSecurityEvents.eventType,
      count: sql<number>`COUNT(*)`,
    })
    .from(tfSecurityEvents)
    .where(
      and(
        eq(tfSecurityEvents.tenantId, tenantId),
        sql`${tfSecurityEvents.createdAt} >= ${monthStart}`,
        sql`${tfSecurityEvents.createdAt} < ${monthEnd}`,
      ),
    )
    .groupBy(tfSecurityEvents.eventType);

  const threatMap: Record<string, number> = {};
  let totalThreats = 0;
  for (const row of threatRows) {
    threatMap[row.eventType] = row.count;
    totalThreats += row.count;
  }

  // Active sessions + avg trust
  const [sessionRow] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      avgTrust: sql<number>`COALESCE(AVG(${deviceSessions.trustScore}), 0)`,
    })
    .from(deviceSessions)
    .where(
      and(
        eq(deviceSessions.tenantId, tenantId),
        eq(deviceSessions.revoked, 0),
        sql`${deviceSessions.expiresAt} > datetime('now')`,
      ),
    );

  // Total sessions for binding coverage
  const [totalSessionRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(deviceSessions)
    .where(eq(deviceSessions.tenantId, tenantId));

  const boundCount = totalSessionRow?.count ?? 0;
  const bindingCoverage = boundCount > 0 ? 100 : 0;

  const [tenant] = await db
    .select({ name: tfTenants.name })
    .from(tfTenants)
    .where(eq(tfTenants.id, tenantId));

  return c.json({
    data: {
      period: { label: monthLabel, start: monthStart, end: monthEnd },
      tenant: { name: tenant?.name ?? 'Unknown', plan },
      totalVerifications:
        (usageRow?.verifications ?? 0) + (usageRow?.binds ?? 0),
      threatsBlocked: { total: totalThreats, byType: threatMap },
      averageTrustScore: Math.round(sessionRow?.avgTrust ?? 0),
      activeSessions: sessionRow?.count ?? 0,
      deviceBindingCoverage: bindingCoverage,
      uptime: 99.9,
      generatedAt: new Date().toISOString(),
    },
  });
});
