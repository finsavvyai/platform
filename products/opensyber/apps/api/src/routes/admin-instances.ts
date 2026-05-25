import { Hono } from 'hono';
import { eq, desc, gt, and } from 'drizzle-orm';
import { instances } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { adminMiddleware } from '../middleware/admin.js';
import { parseCursor, buildNextCursor, parseLimit } from '../utils/pagination.js';

const adminInstanceRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminInstanceRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);

// GET /api/admin/instances?cursor=&limit=
adminInstanceRoutes.get('/', async (c) => {
  const db = c.get('db');
  const cursor = parseCursor(c.req.query('cursor'));
  const limit = parseLimit(c.req.query('limit'));

  const conditions = [];
  if (cursor) {
    conditions.push(gt(instances.createdAt, cursor.createdAt));
  }

  const rows = await db.select().from(instances)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(instances.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? buildNextCursor(last.createdAt, last.id) : null;

  return c.json({ data, nextCursor, hasMore });
});

// POST /api/admin/instances/:id/stop — stop instance
adminInstanceRoutes.post('/:id/stop', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
  if (!inst) return c.json({ error: 'Not Found', message: 'Instance not found' }, 404);

  await db.update(instances).set({
    status: 'stopped',
  }).where(eq(instances.id, id));

  return c.json({ data: { id, status: 'stopped' } });
});

// POST /api/admin/instances/:id/restart — restart instance
adminInstanceRoutes.post('/:id/restart', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
  if (!inst) return c.json({ error: 'Not Found', message: 'Instance not found' }, 404);

  await db.update(instances).set({
    status: 'provisioning',
  }).where(eq(instances.id, id));

  return c.json({ data: { id, status: 'provisioning' } });
});

// DELETE /api/admin/instances/:id — delete instance
adminInstanceRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
  if (!inst) return c.json({ error: 'Not Found', message: 'Instance not found' }, 404);

  await db.delete(instances).where(eq(instances.id, id));

  return new Response(null, { status: 204 });
});

export { adminInstanceRoutes };
