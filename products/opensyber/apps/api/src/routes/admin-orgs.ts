import { Hono } from 'hono';
import { eq, desc, gt, and } from 'drizzle-orm';
import { organizations, orgMembers } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { adminMiddleware } from '../middleware/admin.js';
import { parseCursor, buildNextCursor, parseLimit } from '../utils/pagination.js';
import { updateOrgAdminSchema } from './validation/admin-orgs.js';

const adminOrgRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminOrgRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);

// GET /api/admin/organizations?cursor=&limit=
adminOrgRoutes.get('/', async (c) => {
  const db = c.get('db');
  const cursor = parseCursor(c.req.query('cursor'));
  const limit = parseLimit(c.req.query('limit'));

  const conditions = [];
  if (cursor) {
    conditions.push(gt(organizations.createdAt, cursor.createdAt));
  }

  const rows = await db.select().from(organizations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(organizations.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? buildNextCursor(last.createdAt, last.id) : null;

  return c.json({ data, nextCursor, hasMore });
});

// PATCH /api/admin/organizations/:id — update org plan/limits
adminOrgRoutes.patch('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const parsed = updateOrgAdminSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const body = parsed.data;

  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.plan !== undefined) updates.plan = body.plan;
  if (body.maxInstances !== undefined) updates.maxInstances = body.maxInstances;

  await db.update(organizations).set(updates).where(eq(organizations.id, id));
  return c.json({
    data: { id, plan: body.plan ?? org.plan, maxInstances: body.maxInstances ?? org.maxInstances },
  });
});

// DELETE /api/admin/organizations/:id — delete org (requires ?confirm=true)
adminOrgRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const confirm = c.req.query('confirm');

  if (confirm !== 'true') {
    return c.json({ error: 'Confirmation Required', message: 'Add ?confirm=true to delete' }, 400);
  }

  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);

  await db.delete(orgMembers).where(eq(orgMembers.orgId, id));
  await db.delete(organizations).where(eq(organizations.id, id));

  return new Response(null, { status: 204 });
});

export { adminOrgRoutes };
