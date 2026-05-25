import { Hono } from 'hono';
import { eq, and, desc, gte } from 'drizzle-orm';
import {
  networkActivity, fileBaselines, fileIntegrityEvents,
  accessControlLog, securityEvents,
} from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';

const securityNetworkRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

securityNetworkRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Get network activity
securityNetworkRoutes.get('/instances/:instanceId/network-activity', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const domainFilter = c.req.query('domain');
  const period = c.req.query('period') || '24h';
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const periodHours = period === '7d' ? 168 : period === '48h' ? 48 : 24;
  const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

  let rows = await db.select().from(networkActivity)
    .where(and(eq(networkActivity.instanceId, instanceId), gte(networkActivity.createdAt, since)))
    .orderBy(desc(networkActivity.createdAt)).limit(500);

  if (domainFilter) rows = rows.filter((r: any) => r.domain.includes(domainFilter));

  return c.json({ activity: rows });
});

// Get file baselines
securityNetworkRoutes.get('/instances/:instanceId/file-baselines', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const baselines = await db.select().from(fileBaselines)
    .where(eq(fileBaselines.instanceId, instanceId));

  return c.json({ baselines });
});

// Get file integrity events
securityNetworkRoutes.get('/instances/:instanceId/file-events', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const events = await db.select().from(fileIntegrityEvents)
    .where(eq(fileIntegrityEvents.instanceId, instanceId))
    .orderBy(desc(fileIntegrityEvents.createdAt)).limit(200);

  return c.json({ events });
});

// Get access control log
securityNetworkRoutes.get('/instances/:instanceId/access-log', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const entries = await db.select().from(accessControlLog)
    .where(eq(accessControlLog.instanceId, instanceId))
    .orderBy(desc(accessControlLog.createdAt)).limit(200);

  return c.json({ entries });
});

// Get threat map
securityNetworkRoutes.get('/instances/:instanceId/threat-map', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const period = c.req.query('period') || '24h';
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const periodHours = period === '7d' ? 168 : period === '48h' ? 48 : 24;
  const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

  const secEvents = await db.select().from(securityEvents)
    .where(and(eq(securityEvents.instanceId, instanceId), gte(securityEvents.createdAt, since)));

  const accessEvents = await db.select().from(accessControlLog)
    .where(and(eq(accessControlLog.instanceId, instanceId), gte(accessControlLog.createdAt, since)));

  const countryMap = new Map<string, { count: number; severity: string }>();

  for (const e of secEvents) {
    if (e.sourceCountry) {
      const existing = countryMap.get(e.sourceCountry);
      if (existing) {
        existing.count++;
        if (e.severity === 'critical' || (e.severity === 'warning' && existing.severity === 'info')) {
          existing.severity = e.severity;
        }
      } else {
        countryMap.set(e.sourceCountry, { count: 1, severity: e.severity });
      }
    }
  }

  for (const e of accessEvents) {
    if (e.sourceCountry) {
      const existing = countryMap.get(e.sourceCountry);
      if (existing) {
        existing.count++;
      } else {
        countryMap.set(e.sourceCountry, { count: 1, severity: e.action === 'denied' ? 'warning' : 'info' });
      }
    }
  }

  const entries = [...countryMap.entries()].map(([country, data]) => ({
    country, count: data.count, severity: data.severity,
  }));

  const topCountries = entries.sort((a, b) => b.count - a.count).slice(0, 10);

  return c.json({
    threatMap: {
      entries,
      totalEvents: entries.reduce((sum, e) => sum + e.count, 0),
      topCountries: topCountries.map((e) => ({ country: e.country, count: e.count })),
    },
  });
});

export { securityNetworkRoutes };
