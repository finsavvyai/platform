/**
 * Cycles CRUD routes -- all protected via requireAuth.
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

const cyclesRoute = new Hono<Env>();
cyclesRoute.use('*', requireAuth);

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  status: z.string().optional(),
  startDate: z.number().optional(),
  endDate: z.number().optional(),
});

const updateSchema = createSchema.partial();

// GET / -- list cycles (optionally filtered by projectId)
cyclesRoute.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const projectId = c.req.query('projectId');

  const rows = projectId
    ? await db
        .select()
        .from(schema.cycles)
        .where(eq(schema.cycles.projectId, projectId))
    : await db.select().from(schema.cycles);

  return c.json({ success: true, data: rows });
});

// POST / -- create cycle
cyclesRoute.post('/', async (c) => {
  const parsed = await parseJsonBody(c, createSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const body = parsed.data;
  const db = drizzle(c.env.DB);
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.cycles).values({
    id,
    projectId: body.projectId,
    name: body.name,
    description: body.description ?? null,
    status: body.status ?? 'planning',
    startDate: body.startDate ? new Date(body.startDate) : null,
    endDate: body.endDate ? new Date(body.endDate) : null,
    ownerId: c.get('userId'),
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ success: true, data: { id } }, 201);
});

// GET /:id
cyclesRoute.get('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(schema.cycles)
    .where(eq(schema.cycles.id, c.req.param('id')))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ success: false, error: 'Cycle not found' }, 404);
  }
  return c.json({ success: true, data: rows[0] });
});

// PATCH /:id
cyclesRoute.patch('/:id', async (c) => {
  const parsed = await parseJsonBody(c, updateSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const body = parsed.data;
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');

  const existing = await db
    .select({ id: schema.cycles.id })
    .from(schema.cycles)
    .where(eq(schema.cycles.id, id))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ success: false, error: 'Cycle not found' }, 404);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.startDate !== undefined) updates.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) updates.endDate = new Date(body.endDate);

  await db
    .update(schema.cycles)
    .set(updates)
    .where(eq(schema.cycles.id, id));

  return c.json({ success: true, message: 'Cycle updated' });
});

// DELETE /:id
cyclesRoute.delete('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(schema.cycles).where(eq(schema.cycles.id, c.req.param('id')));
  return c.json({ success: true, message: 'Cycle deleted' });
});

export default cyclesRoute;
