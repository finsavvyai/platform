/**
 * Test Cases CRUD routes -- all protected via requireAuth.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requireAuth } from '../middleware/honoAuth';
import { parseJsonBody } from '../utils/validateJsonBody';
import { allocateDisplayId } from '../lib/display-id';

type Env = {
  Bindings: { DB: D1Database; ENVIRONMENT: string; JWT_SECRET: string };
  Variables: { userId: string; userRole: string };
};

const testCasesRoute = new Hono<Env>();
// Require JWT on all test case operations (prevents data leak)
testCasesRoute.use('*', requireAuth);

const fallbackTestCases = [
  {
    id: 'TC-DEMO-1',
    displayId: 'TC-0001',
    projectId: 'demo',
    title: 'Verify login with valid credentials',
    status: 'Active',
    priority: 'High',
    type: 'Functional',
    jiraIssue: 'QES-101',
    description: 'Confirm that a signed-in user can access the dashboard from the login page.',
    testCode: null,
    testData: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
  {
    id: 'TC-DEMO-2',
    displayId: 'TC-0002',
    projectId: 'demo',
    title: 'Validate billing page plan summary',
    status: 'Draft',
    priority: 'Medium',
    type: 'E2E',
    jiraIssue: 'QES-118',
    description: 'Check that subscription usage and current plan details are visible on the billing screen.',
    testCode: null,
    testData: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 90),
  },
];

const isMissingLocalTableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('no such table') || message.includes('SQLITE_ERROR');
};

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(500),
  status: z.string().optional(),
  priority: z.string().optional(),
  type: z.string().optional(),
  jiraIssue: z.string().optional(),
  description: z.string().optional(),
  testCode: z.string().optional(),
  testData: z.string().optional(),
});

const updateSchema = createSchema.partial();

const updateTestCase = async (
  c: Context<Env, '/:id'>,
  body: z.infer<typeof updateSchema>,
) => {
  const id = c.req.param('id');

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.type !== undefined) updates.type = body.type;
  if (body.description !== undefined) updates.description = body.description;
  if (body.testCode !== undefined) updates.testCode = body.testCode;
  if (body.jiraIssue !== undefined) updates.jiraIssue = body.jiraIssue;
  if (body.testData !== undefined) updates.testData = body.testData;

  try {
    const db = drizzle(c.env.DB);
    const existing = await db
      .select({ id: schema.testCases.id })
      .from(schema.testCases)
      .where(eq(schema.testCases.id, id))
      .limit(1);
    if (existing.length === 0) {
      return c.json({ success: false, error: 'Test case not found' }, 404);
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(schema.testCases)
        .set(updates)
        .where(eq(schema.testCases.id, id));
    }
  } catch (error) {
    if (!isMissingLocalTableError(error)) {
      throw error;
    }

    const fallback = fallbackTestCases.find((testCase) => testCase.id === id);
    if (!fallback) {
      return c.json({ success: false, error: 'Test case not found' }, 404);
    }

    Object.assign(fallback, updates);
  }
  return c.json({ success: true, message: 'Test case updated' });
};

// GET / -- list test cases, with optional filters
testCasesRoute.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const projectId = c.req.query('projectId');
  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const type = c.req.query('type');

  try {
    const conditions = [];
    if (projectId) conditions.push(eq(schema.testCases.projectId, projectId));
    if (status) conditions.push(eq(schema.testCases.status, status));
    if (priority) conditions.push(eq(schema.testCases.priority, priority));
    if (type) conditions.push(eq(schema.testCases.type, type));

    const rows =
      conditions.length > 0
        ? await db
            .select()
            .from(schema.testCases)
            .where(and(...conditions))
        : await db.select().from(schema.testCases);

    if (rows.length > 0) {
      return c.json({ success: true, data: rows });
    }
  } catch (error) {
    if (!isMissingLocalTableError(error)) {
      throw error;
    }
  }

  const filteredFallback = fallbackTestCases.filter((testCase) => {
    if (projectId && testCase.projectId !== projectId) return false;
    if (status && testCase.status !== status) return false;
    if (priority && testCase.priority !== priority) return false;
    if (type && testCase.type !== type) return false;
    return true;
  });

  return c.json({ success: true, data: filteredFallback });
});

// POST / -- create test case
testCasesRoute.post('/', async (c) => {
  const parsed = await parseJsonBody(c, createSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const body = parsed.data;
  const id = crypto.randomUUID();

  // Allocate human-readable display ID (e.g. "TC-0042") before insert.
  // If allocator fails (migration not applied yet), fall back to null so the
  // write still succeeds — legacy rows tolerate a null display_id.
  let displayId: string | null = null;
  try {
    displayId = await allocateDisplayId(c.env.DB, 'test_case');
  } catch (error) {
    console.error('display-id allocation failed for test_case:', error);
  }

  const newTestCase = {
    id,
    displayId,
    projectId: body.projectId,
    title: body.title,
    status: body.status ?? 'Draft',
    priority: body.priority ?? 'Medium',
    type: body.type ?? 'Functional',
    jiraIssue: body.jiraIssue ?? null,
    description: body.description ?? null,
    testCode: body.testCode ?? null,
    testData: body.testData ?? null,
    createdAt: new Date(),
  };

  try {
    const db = drizzle(c.env.DB);
    await db.insert(schema.testCases).values(newTestCase);
  } catch (error) {
    if (!isMissingLocalTableError(error)) {
      throw error;
    }
    fallbackTestCases.unshift(newTestCase);
  }

  return c.json({ success: true, data: newTestCase }, 201);
});

// GET /:id -- get single test case
testCasesRoute.get('/:id', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const rows = await db
      .select()
      .from(schema.testCases)
      .where(eq(schema.testCases.id, c.req.param('id')))
      .limit(1);
    if (rows.length > 0) {
      return c.json({ success: true, data: rows[0] });
    }
  } catch (error) {
    if (!isMissingLocalTableError(error)) {
      throw error;
    }
  }

  const fallback = fallbackTestCases.find((testCase) => testCase.id === c.req.param('id'));
  if (!fallback) {
    return c.json({ success: false, error: 'Test case not found' }, 404);
  }

  return c.json({ success: true, data: fallback });
});

// PATCH /:id -- update test case
testCasesRoute.patch('/:id', async (c) => {
  const parsed = await parseJsonBody(c, updateSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  return updateTestCase(c, parsed.data);
});

testCasesRoute.put('/:id', async (c) => {
  const parsed = await parseJsonBody(c, updateSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  return updateTestCase(c, parsed.data);
});

// DELETE /:id
testCasesRoute.delete('/:id', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    await db.delete(schema.testCases).where(eq(schema.testCases.id, c.req.param('id')));
  } catch (error) {
    if (!isMissingLocalTableError(error)) {
      throw error;
    }
    const index = fallbackTestCases.findIndex((testCase) => testCase.id === c.req.param('id'));
    if (index >= 0) {
      fallbackTestCases.splice(index, 1);
    }
  }
  return c.json({ success: true, message: 'Test case deleted' });
});

// POST /bulk -- bulk create test cases
testCasesRoute.post('/bulk', async (c) => {
  let body: { testCases?: Array<Record<string, unknown>> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const cases = body.testCases || [];
  if (!Array.isArray(cases) || cases.length === 0) {
    return c.json({ success: false, error: 'No test cases provided' }, 400);
  }

  const created: Array<Record<string, unknown>> = [];
  for (const tc of cases) {
    const id = crypto.randomUUID();
    let displayId: string | null = null;
    try {
      displayId = await allocateDisplayId(c.env.DB, 'test_case');
    } catch (error) {
      console.error('display-id allocation failed in bulk create:', error);
    }
    const newTc = {
      id,
      displayId,
      projectId: (tc.projectId as string) || 'default',
      title: (tc.title as string) || (tc.name as string) || `Test ${id}`,
      status: (tc.status as string) || 'Active',
      priority: (tc.priority as string) || 'Medium',
      type: (tc.type as string) || 'Functional',
      jiraIssue: (tc.jiraIssue as string) || null,
      description: (tc.description as string) || null,
      testCode: (tc.testCode as string) || null,
      testData: (tc.testData as string) || null,
      createdAt: new Date(),
    };

    try {
      const db = drizzle(c.env.DB);
      await db.insert(schema.testCases).values(newTc);
    } catch {
      fallbackTestCases.push(newTc);
    }
    created.push(newTc);
  }

  return c.json({
    success: true,
    data: created,
    total: created.length,
    message: `Created ${created.length} test cases`,
  }, 201);
});

// POST /:id/run -- simulate running a test case
testCasesRoute.post('/:id/run', async (c) => {
  const id = c.req.param('id');
  const passed = Math.random() > 0.15;

  return c.json({
    success: true,
    data: {
      runId: `run-${crypto.randomUUID().slice(0, 8)}`,
      testCaseId: id,
      status: passed ? 'passed' : 'failed',
      duration: Math.floor(Math.random() * 3000) + 500,
      timestamp: new Date().toISOString(),
      details: passed
        ? { message: 'All assertions passed' }
        : { message: 'Assertion failed: expected 200, got 404', step: 3 },
    },
  });
});

export default testCasesRoute;
