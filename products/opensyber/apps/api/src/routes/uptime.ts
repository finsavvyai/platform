import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { getUptime, getDowntimeEvents } from '../services/uptime.js';

const uptimeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

uptimeRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Get uptime statistics for an instance
uptimeRoutes.get('/uptime/:instanceId', async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const instance = await verifyInstanceAccess(
    db as any, instanceId, c.get('userId'), c.get('orgId'),
  );

  if (!instance) {
    return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
  }

  const period = (c.req.query('period') || '30d') as '24h' | '7d' | '30d' | '90d';
  const validPeriods = new Set(['24h', '7d', '30d', '90d']);
  if (!validPeriods.has(period)) {
    return c.json({ error: 'Bad request', message: 'Period must be 24h, 7d, 30d, or 90d' }, 400);
  }

  const uptime = await getUptime(db as any, instanceId, period);
  return c.json({ data: { ...uptime, period, instanceId } });
});

// Get downtime events for an instance
uptimeRoutes.get('/uptime/:instanceId/events', async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const instance = await verifyInstanceAccess(
    db as any, instanceId, c.get('userId'), c.get('orgId'),
  );

  if (!instance) {
    return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
  }

  const period = (c.req.query('period') || '30d') as '24h' | '7d' | '30d' | '90d';
  const events = await getDowntimeEvents(db as any, instanceId, period);

  return c.json({ data: events });
});

export { uptimeRoutes };
