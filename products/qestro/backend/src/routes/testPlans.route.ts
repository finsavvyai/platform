/**
 * Test Plans CRUD routes -- all protected via requireAuth.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requireAuth } from '../middleware/honoAuth';
import { parseJsonBody } from '../utils/validateJsonBody';
import { allocateDisplayId } from '../lib/display-id';

type Env = {
  Bindings: { DB: D1Database; ENVIRONMENT: string; JWT_SECRET: string };
  Variables: { userId: string; userRole: string };
};

const testPlansRoute = new Hono<Env>();
testPlansRoute.use('*', requireAuth);

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  status: z.string().optional(),
});

const updateSchema = createSchema.partial();

// GET / -- list test plans (optionally filtered by projectId)
testPlansRoute.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const projectId = c.req.query('projectId');

  const rows = projectId
    ? await db
        .select()
        .from(schema.testPlans)
        .where(eq(schema.testPlans.projectId, projectId))
    : await db.select().from(schema.testPlans);

  return c.json({ success: true, data: rows });
});

// POST / -- create test plan
testPlansRoute.post('/', async (c) => {
  const parsed = await parseJsonBody(c, createSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const body = parsed.data;
  const db = drizzle(c.env.DB);
  const id = crypto.randomUUID();
  const now = new Date();

  let displayId: string | null = null;
  try {
    displayId = await allocateDisplayId(c.env.DB, 'test_plan');
  } catch (error) {
    console.error('display-id allocation failed for test_plan:', error);
  }

  await db.insert(schema.testPlans).values({
    id,
    displayId,
    projectId: body.projectId,
    name: body.name,
    description: body.description ?? null,
    status: body.status ?? 'draft',
    ownerId: c.get('userId'),
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ success: true, data: { id, displayId } }, 201);
});

// GET /:id
testPlansRoute.get('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(schema.testPlans)
    .where(eq(schema.testPlans.id, c.req.param('id')))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ success: false, error: 'Test plan not found' }, 404);
  }
  return c.json({ success: true, data: rows[0] });
});

// PATCH /:id
testPlansRoute.patch('/:id', async (c) => {
  const parsed = await parseJsonBody(c, updateSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const body = parsed.data;
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');

  const existing = await db
    .select({ id: schema.testPlans.id })
    .from(schema.testPlans)
    .where(eq(schema.testPlans.id, id))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ success: false, error: 'Test plan not found' }, 404);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;

  await db
    .update(schema.testPlans)
    .set(updates)
    .where(eq(schema.testPlans.id, id));

  return c.json({ success: true, message: 'Test plan updated' });
});

// DELETE /:id
testPlansRoute.delete('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(schema.testPlans).where(eq(schema.testPlans.id, c.req.param('id')));
  return c.json({ success: true, message: 'Test plan deleted' });
});

export default testPlansRoute;
