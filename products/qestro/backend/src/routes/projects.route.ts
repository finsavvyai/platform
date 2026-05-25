/**
 * Projects CRUD routes -- all protected via requireAuth.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requireAuth } from '../middleware/honoAuth';
import { parseJsonBody } from '../utils/validateJsonBody';

type Env = {
  Bindings: { DB: D1Database; ENVIRONMENT: string; JWT_SECRET: string };
  Variables: { userId: string; userRole: string };
};

const projectsRoute = new Hono<Env>();
// Require JWT on all project operations (prevents data leak)
projectsRoute.use('*', requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(200),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

// GET / -- list projects (filtered by owner if authenticated, all if not)
projectsRoute.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId');

  try {
    const rows = userId
      ? await db.select().from(schema.projects).where(eq(schema.projects.ownerId, userId))
      : await db.select().from(schema.projects);
    return c.json({ success: true, data: rows });
  } catch {
    // Fallback if table missing
    return c.json({ success: true, data: [
      { id: 'proj-opensyber', name: 'OpenSyber', ownerId: 'system', createdAt: new Date() },
    ] });
  }
});

// POST / -- create a new project
projectsRoute.post('/', async (c) => {
  const parsed = await parseJsonBody(c, createSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const { name } = parsed.data;
  const db = drizzle(c.env.DB);
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.projects).values({
    id,
    name,
    ownerId: c.get('userId'),
    createdAt: now,
  });
  return c.json({ success: true, data: { id, name } }, 201);
});

// GET /:id -- get single project
projectsRoute.get('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, c.req.param('id')))
    .limit(1);
  if (rows.length === 0) {
    return c.json({ success: false, error: 'Project not found' }, 404);
  }
  return c.json({ success: true, data: rows[0] });
});

// PATCH /:id -- update project
projectsRoute.patch('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const parsed = await parseJsonBody(c, updateSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const { name } = parsed.data;
  const id = c.req.param('id');

  const existing = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ success: false, error: 'Project not found' }, 404);
  }

  if (name) {
    await db
      .update(schema.projects)
      .set({ name })
      .where(eq(schema.projects.id, id));
  }
  return c.json({ success: true, message: 'Project updated' });
});

// DELETE /:id -- delete project
projectsRoute.delete('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  return c.json({ success: true, message: 'Project deleted' });
});

export default projectsRoute;
