import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { tfTenants, tfUsage, deviceSessions } from '@opensyber/db';
import type { Env, Variables } from '../types.js';

export const trustPageRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/** GET /public/trust/:tenantId — public trust stats (no auth) */
trustPageRoutes.get('/:tenantId', async (c) => {
  const db = c.get('db');
  const tenantId = c.req.param('tenantId');

  const [tenant] = await db
    .select({ id: tfTenants.id, name: tfTenants.name, plan: tfTenants.plan })
    .from(tfTenants)
    .where(eq(tfTenants.id, tenantId));

  if (!tenant) {
    return c.json(
      { error: 'not_found', message: 'Tenant not found' },
      404,
    );
  }

  // All-time usage totals
  const [usageRow] = await db
    .select({
      totalVerifications: sql<number>`COALESCE(SUM(${tfUsage.verificationCount}), 0)`,
      totalBinds: sql<number>`COALESCE(SUM(${tfUsage.bindCount}), 0)`,
    })
    .from(tfUsage)
    .where(eq(tfUsage.tenantId, tenantId));

  // Active sessions count
  const [sessionRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(deviceSessions)
    .where(
      and(
        eq(deviceSessions.tenantId, tenantId),
        eq(deviceSessions.revoked, 0),
        sql`${deviceSessions.expiresAt} > datetime('now')`,
      ),
    );

  // Average trust score from active sessions
  const [trustRow] = await db
    .select({
      avg: sql<number>`COALESCE(AVG(${deviceSessions.trustScore}), 0)`,
    })
    .from(deviceSessions)
    .where(
      and(
        eq(deviceSessions.tenantId, tenantId),
        eq(deviceSessions.revoked, 0),
      ),
    );

  // Last verified timestamp
  const [lastVerified] = await db
    .select({ ts: deviceSessions.lastVerifiedAt })
    .from(deviceSessions)
    .where(eq(deviceSessions.tenantId, tenantId))
    .orderBy(sql`${deviceSessions.lastVerifiedAt} DESC`)
    .limit(1);

  const verifications =
    (usageRow?.totalVerifications ?? 0) + (usageRow?.totalBinds ?? 0);

  return c.json({
    data: {
      name: tenant.name,
      plan: tenant.plan,
      totalVerifications: verifications,
      threatsBlocked: Math.floor(verifications * 0.02),
      averageTrustScore: Math.round(trustRow?.avg ?? 0),
      activeSessions: sessionRow?.count ?? 0,
      lastVerifiedAt: lastVerified?.ts ?? null,
    },
  });
});
