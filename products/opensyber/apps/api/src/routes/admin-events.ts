import { Hono } from 'hono';
import { desc, gt, and, eq, gte, lte } from 'drizzle-orm';
import { securityEvents } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { adminMiddleware } from '../middleware/admin.js';
import { parseCursor, buildNextCursor, parseLimit, parseDateRange } from '../utils/pagination.js';

const adminEventRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminEventRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);

// GET /api/admin/events?severity=&cursor=&limit=&from=&to=
adminEventRoutes.get('/', async (c) => {
  const db = c.get('db');
  const cursor = parseCursor(c.req.query('cursor'));
  const limit = parseLimit(c.req.query('limit'));
  const severity = c.req.query('severity');
  const { from, to } = parseDateRange(c.req.query('from'), c.req.query('to'));

  const conditions = [];
  if (cursor) conditions.push(gt(securityEvents.createdAt, cursor.createdAt));
  if (severity) conditions.push(eq(securityEvents.severity, severity as 'info' | 'warning' | 'critical'));
  if (from) conditions.push(gte(securityEvents.createdAt, from));
  if (to) conditions.push(lte(securityEvents.createdAt, to));

  const rows = await db.select().from(securityEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? buildNextCursor(last.createdAt, last.id) : null;

  return c.json({ data, nextCursor, hasMore });
});

export { adminEventRoutes };
