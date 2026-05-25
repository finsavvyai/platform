import { Hono } from 'hono';
import { eq, desc, gte, sql, count } from 'drizzle-orm';
import { securityEvents } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';

const threatRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

threatRoutes.use('*', dbMiddleware);

// GET /live — Public aggregated threat intelligence feed
threatRoutes.get('/live', async (c) => {
  const db = c.get('db');
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const cutoff24h = new Date(now - day).toISOString();
  const cutoff7d = new Date(now - 7 * day).toISOString();
  const cutoff30d = new Date(now - 30 * day).toISOString();

  // Fetch recent events (anonymized — no instanceId/userId)
  const recentRows = await db
    .select({
      eventType: securityEvents.eventType,
      severity: securityEvents.severity,
      sourceCountry: securityEvents.sourceCountry,
      createdAt: securityEvents.createdAt,
    })
    .from(securityEvents)
    .orderBy(desc(securityEvents.createdAt))
    .limit(20);

  // Count events by time window
  const [count24h] = await db
    .select({ total: count() })
    .from(securityEvents)
    .where(gte(securityEvents.createdAt, cutoff24h));
  const [count7d] = await db
    .select({ total: count() })
    .from(securityEvents)
    .where(gte(securityEvents.createdAt, cutoff7d));
  const [count30d] = await db
    .select({ total: count() })
    .from(securityEvents)
    .where(gte(securityEvents.createdAt, cutoff30d));

  // Threats blocked (critical + warning events in 30d)
  const [blocked] = await db
    .select({ total: count() })
    .from(securityEvents)
    .where(gte(securityEvents.createdAt, cutoff30d));

  // Top countries
  const topCountries = await db
    .select({
      country: securityEvents.sourceCountry,
      eventCount: count(),
    })
    .from(securityEvents)
    .where(gte(securityEvents.createdAt, cutoff30d))
    .groupBy(securityEvents.sourceCountry)
    .orderBy(desc(count()))
    .limit(10);

  // Events by type
  const byType = await db
    .select({
      eventType: securityEvents.eventType,
      eventCount: count(),
    })
    .from(securityEvents)
    .where(gte(securityEvents.createdAt, cutoff30d))
    .groupBy(securityEvents.eventType)
    .orderBy(desc(count()));

  // Events by severity
  const bySeverity = await db
    .select({
      severity: securityEvents.severity,
      eventCount: count(),
    })
    .from(securityEvents)
    .where(gte(securityEvents.createdAt, cutoff30d))
    .groupBy(securityEvents.severity)
    .orderBy(desc(count()));

  const uniqueCountries = topCountries.filter((r) => r.country).length;

  c.header('Cache-Control', 'public, s-maxage=60');
  return c.json({
    recentEvents: recentRows,
    stats: {
      events24h: count24h?.total ?? 0,
      events7d: count7d?.total ?? 0,
      events30d: count30d?.total ?? 0,
      threatsBlocked: blocked?.total ?? 0,
      uniqueCountries,
    },
    topCountries: topCountries.filter((r) => r.country),
    byType,
    bySeverity,
  });
});

export { threatRoutes };
