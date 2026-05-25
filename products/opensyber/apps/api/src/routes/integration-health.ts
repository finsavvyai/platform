import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { integrationConnections, integrationEvents } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';

type HealthStatus = 'healthy' | 'degraded' | 'down';

const connectionIdSchema = z.object({
  connectionId: z.string().min(1, 'connectionId is required'),
});

const integrationHealthRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

integrationHealthRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/**
 * Compute health status for an integration connection.
 * - down: consecutiveFailures >= 3
 * - degraded: errorCount > 0 with recent error (last hour) or latency > 5000ms
 * - healthy: otherwise
 */
function computeHealth(conn: {
  consecutiveFailures: number;
  errorCount: number;
  lastErrorAt: string | null;
  avgLatencyMs: number;
}): HealthStatus {
  if (conn.consecutiveFailures >= 3) return 'down';

  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const hasRecentError = conn.lastErrorAt && conn.lastErrorAt > oneHourAgo;

  if (hasRecentError || conn.avgLatencyMs > 5000) return 'degraded';

  return 'healthy';
}

/** GET /health — Health summary for all user integrations */
integrationHealthRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const connections = await db
    .select({
      id: integrationConnections.id,
      integrationSlug: integrationConnections.integrationSlug,
      status: integrationConnections.status,
      lastSyncAt: integrationConnections.lastSyncAt,
      eventsReceived: integrationConnections.eventsReceived,
      errorCount: integrationConnections.errorCount,
      lastErrorAt: integrationConnections.lastErrorAt,
      consecutiveFailures: integrationConnections.consecutiveFailures,
      avgLatencyMs: integrationConnections.avgLatencyMs,
    })
    .from(integrationConnections)
    .where(eq(integrationConnections.userId, userId));

  const integrations = connections.map((conn) => ({
    id: conn.id,
    slug: conn.integrationSlug,
    status: conn.status,
    lastSyncAt: conn.lastSyncAt,
    eventsReceived: conn.eventsReceived,
    errorCount: conn.errorCount,
    lastErrorAt: conn.lastErrorAt,
    consecutiveFailures: conn.consecutiveFailures,
    avgLatencyMs: conn.avgLatencyMs,
    health: computeHealth(conn),
  }));

  const summary = {
    healthy: integrations.filter((i) => i.health === 'healthy').length,
    degraded: integrations.filter((i) => i.health === 'degraded').length,
    down: integrations.filter((i) => i.health === 'down').length,
  };

  return c.json({ integrations, summary });
});

/** GET /health/:connectionId/events — Last 20 events with latency */
integrationHealthRoutes.get('/:connectionId/events', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const parsed = connectionIdSchema.safeParse({ connectionId: c.req.param('connectionId') });

  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const { connectionId } = parsed.data;

  // Verify user owns this connection
  const [conn] = await db
    .select({ id: integrationConnections.id })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.userId, userId),
      ),
    );

  if (!conn) {
    return c.json({ error: 'Not found', message: 'Connection not found' }, 404);
  }

  const events = await db
    .select({
      id: integrationEvents.id,
      eventType: integrationEvents.eventType,
      severity: integrationEvents.severity,
      summary: integrationEvents.summary,
      latencyMs: integrationEvents.latencyMs,
      createdAt: integrationEvents.createdAt,
    })
    .from(integrationEvents)
    .where(eq(integrationEvents.connectionId, connectionId))
    .orderBy(desc(integrationEvents.createdAt))
    .limit(20);

  return c.json({ events });
});

export { integrationHealthRoutes };
