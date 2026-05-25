import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { integrationConnections } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { getSloTier, computeSloStatus, checkSloBreaches } from '../services/slo-monitor.js';

const sloRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

sloRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/**
 * GET /api/integrations/slo — Returns per-integration SLO status, tier, compliance %.
 */
sloRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const connections = await db
    .select({
      id: integrationConnections.id,
      slug: integrationConnections.integrationSlug,
      status: integrationConnections.status,
      avgLatencyMs: integrationConnections.avgLatencyMs,
      eventsReceived: integrationConnections.eventsReceived,
      errorCount: integrationConnections.errorCount,
      lastSyncAt: integrationConnections.lastSyncAt,
      lastErrorAt: integrationConnections.lastErrorAt,
    })
    .from(integrationConnections)
    .where(eq(integrationConnections.userId, userId));

  const integrations = [];
  for (const conn of connections) {
    const tier = getSloTier(conn.slug);
    const sloStatus = computeSloStatus({
      integrationSlug: conn.slug,
      avgLatencyMs: conn.avgLatencyMs,
      eventsReceived: conn.eventsReceived,
      errorCount: conn.errorCount,
    });

    integrations.push({
      connectionId: conn.id,
      slug: conn.slug,
      status: conn.status,
      tier,
      slo: sloStatus,
      lastSyncAt: conn.lastSyncAt,
      lastErrorAt: conn.lastErrorAt,
    });
  }

  // Fetch breached SLOs
  const breaches = await checkSloBreaches(db, userId);

  const summary = {
    total: integrations.length,
    withSlo: integrations.filter((i) => i.tier).length,
    breached: breaches.length,
    complianceAvg: integrations
      .filter((i) => i.slo)
      .reduce((sum, i) => sum + (i.slo?.compliance ?? 0), 0) /
      Math.max(integrations.filter((i) => i.slo).length, 1),
  };

  return c.json({ integrations, summary, breaches });
});

export { sloRoutes };
