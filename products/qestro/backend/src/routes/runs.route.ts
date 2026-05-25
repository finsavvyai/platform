/**
 * Test Runs CRUD routes + status transitions -- all protected via requireAuth.
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

const runsRoute = new Hono<Env>();
runsRoute.use('*', requireAuth);

const createSchema = z.object({
  projectId: z.string().min(1),
  testPlanId: z.string().optional(),
  name: z.string().min(1).max(300),
  environment: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  status: z.string().optional(),
  environment: z.string().optional(),
  passed: z.number().int().min(0).optional(),
  failed: z.number().int().min(0).optional(),
  skipped: z.number().int().min(0).optional(),
  total: z.number().int().min(0).optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['running', 'cancelled'],
  running: ['passed', 'failed', 'cancelled'],
  passed: [],
  failed: ['running'],
  cancelled: ['pending'],
};

// GET / -- list test runs (optionally filtered by projectId)
runsRoute.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const projectId = c.req.query('projectId');

  const rows = projectId
    ? await db
        .select()
        .from(schema.testRuns)
        .where(eq(schema.testRuns.projectId, projectId))
    : await db.select().from(schema.testRuns);

  return c.json({ success: true, data: rows });
});

// POST / -- create test run
runsRoute.post('/', async (c) => {
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
    displayId = await allocateDisplayId(c.env.DB, 'test_run');
  } catch (error) {
    console.error('display-id allocation failed for test_run:', error);
  }

  await db.insert(schema.testRuns).values({
    id,
    displayId,
    testPlanId: body.testPlanId ?? null,
    projectId: body.projectId,
    name: body.name,
    status: 'pending',
    environment: body.environment ?? null,
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    startedAt: null,
    completedAt: null,
    createdAt: now,
  });

  return c.json({ success: true, data: { id, displayId } }, 201);
});

// GET /:id
runsRoute.get('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(schema.testRuns)
    .where(eq(schema.testRuns.id, c.req.param('id')))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ success: false, error: 'Test run not found' }, 404);
  }
  return c.json({ success: true, data: rows[0] });
});

// PATCH /:id -- update test run (with status transition validation)
runsRoute.patch('/:id', async (c) => {
  const parsed = await parseJsonBody(c, updateSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const body = parsed.data;
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');

  const existing = await db
    .select()
    .from(schema.testRuns)
    .where(eq(schema.testRuns.id, id))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ success: false, error: 'Test run not found' }, 404);
  }

  const current = existing[0];

  if (body.status && body.status !== current.status) {
    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(body.status)) {
      return c.json(
        { success: false, error: `Cannot transition from '${current.status}' to '${body.status}'` },
        400,
      );
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) updates.status = body.status;
  if (body.environment !== undefined) updates.environment = body.environment;
  if (body.passed !== undefined) updates.passed = body.passed;
  if (body.failed !== undefined) updates.failed = body.failed;
  if (body.skipped !== undefined) updates.skipped = body.skipped;
  if (body.total !== undefined) updates.total = body.total;

  if (body.status === 'running' && !current.startedAt) {
    updates.startedAt = new Date();
  }
  if (body.status === 'passed' || body.status === 'failed' || body.status === 'cancelled') {
    updates.completedAt = new Date();
  }

  if (Object.keys(updates).length > 0) {
    await db.update(schema.testRuns).set(updates).where(eq(schema.testRuns.id, id));
  }

  return c.json({ success: true, message: 'Test run updated' });
});

// DELETE /:id
runsRoute.delete('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(schema.testRuns).where(eq(schema.testRuns.id, c.req.param('id')));
  return c.json({ success: true, message: 'Test run deleted' });
});

export default runsRoute;
