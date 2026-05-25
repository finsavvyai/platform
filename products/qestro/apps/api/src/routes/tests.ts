import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { testGenerator } from '../services/testGenerator';
import { testRunner } from '../services/testRunner';

type Bindings = {
  DB: D1Database;
  OPENAI_API_KEY: string;
};

const testRouter = new Hono<{ Bindings: Bindings }>();

const CreateTestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(10),
  projectId: z.string().uuid(),
});

const RunTestSchema = z.object({
  testId: z.string().uuid(),
  appUrl: z.string().url(),
});

// GET /api/tests - List user's tests
testRouter.get('/', async (c) => {
  try {
    const db = c.env.DB as D1Database;
    const { results } = await db
      .prepare('SELECT * FROM tests WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
      .bind(c.req.header('x-user-id'))
      .all();
    return c.json({ tests: results || [] });
  } catch (error) {
    return c.json({ error: 'Failed to fetch tests' }, 500);
  }
});

// POST /api/tests - Create new test
testRouter.post('/', zValidator('json', CreateTestSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const userId = c.req.header('x-user-id');
    const db = c.env.DB as D1Database;

    const testId = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO tests (id, user_id, project_id, name, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(testId, userId, body.projectId, body.name, body.description, new Date().toISOString())
      .run();

    return c.json({ testId, name: body.name }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create test' }, 500);
  }
});

// POST /api/tests/:id/generate - AI generate test steps
testRouter.post('/:id/generate', async (c) => {
  try {
    const testId = c.req.param('id');
    const db = c.env.DB as D1Database;

    const { results } = await db
      .prepare('SELECT description FROM tests WHERE id = ? AND user_id = ?')
      .bind(testId, c.req.header('x-user-id'))
      .all();

    if (!results?.[0]) {
      return c.json({ error: 'Test not found' }, 404);
    }

    const steps = await testGenerator.generate(
      (results[0] as { description: string }).description,
      c.env.OPENAI_API_KEY
    );

    await db
      .prepare('UPDATE tests SET steps = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(steps), new Date().toISOString(), testId)
      .run();

    return c.json({ testId, steps });
  } catch (error) {
    return c.json({ error: 'Failed to generate test steps' }, 500);
  }
});

// POST /api/tests/:id/run - Execute test
testRouter.post('/:id/run', zValidator('json', RunTestSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const db = c.env.DB as D1Database;

    const { results } = await db
      .prepare('SELECT steps FROM tests WHERE id = ? AND user_id = ?')
      .bind(body.testId, c.req.header('x-user-id'))
      .all();

    if (!results?.[0]) {
      return c.json({ error: 'Test not found' }, 404);
    }

    const steps = JSON.parse((results[0] as { steps: string }).steps);
    const result = await testRunner.execute(steps, body.appUrl);

    const runId = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO test_runs (id, test_id, user_id, result, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(runId, body.testId, c.req.header('x-user-id'), JSON.stringify(result), new Date().toISOString())
      .run();

    return c.json({ runId, result });
  } catch (error) {
    return c.json({ error: 'Test execution failed' }, 500);
  }
});

// GET /api/tests/:id - Get test details
testRouter.get('/:id', async (c) => {
  try {
    const testId = c.req.param('id');
    const db = c.env.DB as D1Database;
    const { results } = await db
      .prepare('SELECT * FROM tests WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(testId, c.req.header('x-user-id'))
      .all();

    if (!results?.[0]) {
      return c.json({ error: 'Test not found' }, 404);
    }
    return c.json({ test: results[0] });
  } catch (error) {
    return c.json({ error: 'Failed to fetch test' }, 500);
  }
});

// DELETE /api/tests/:id - Delete test
testRouter.delete('/:id', async (c) => {
  try {
    const testId = c.req.param('id');
    const db = c.env.DB as D1Database;
    await db
      .prepare('DELETE FROM tests WHERE id = ? AND user_id = ?')
      .bind(testId, c.req.header('x-user-id'))
      .run();
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete test' }, 500);
  }
});

export default testRouter;
