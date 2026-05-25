import { Hono } from 'hono';
import { eq, and, desc, gt } from 'drizzle-orm';
import { tfSecurityEvents } from '@opensyber/db';
import type { Env, Variables } from '../types.js';

export const eventRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/** GET /v1/events — list security events for tenant (cursor pagination) */
eventRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const cursor = c.req.query('cursor');
  const limitParam = parseInt(c.req.query('limit') ?? '20', 10);
  const limit = Math.min(Math.max(limitParam, 1), 100);
  const eventType = c.req.query('eventType');
  const userId = c.req.query('userId');

  // Build conditions
  const conditions = [eq(tfSecurityEvents.tenantId, tenantId)];

  if (cursor) {
    conditions.push(gt(tfSecurityEvents.id, cursor));
  }
  if (eventType) {
    conditions.push(eq(tfSecurityEvents.eventType, eventType));
  }
  if (userId) {
    conditions.push(eq(tfSecurityEvents.userId, userId));
  }

  const rows = await db
    .select()
    .from(tfSecurityEvents)
    .where(and(...conditions))
    .orderBy(desc(tfSecurityEvents.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && data.length > 0 ? data[data.length - 1]!.id : null;

  return c.json({ data, nextCursor, hasMore });
});
