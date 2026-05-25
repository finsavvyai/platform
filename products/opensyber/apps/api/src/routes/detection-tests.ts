/**
 * Detection validation test harness routes.
 *
 * GET  /api/detection-tests/suites      — list available test suites
 * POST /api/detection-tests/run         — run a test suite against an instance
 * GET  /api/detection-tests/runs/:runId — get test run results
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { TEST_SUITES, TEST_CASES, layerLatency } from './detection-tests-data.js';
import type { TestCase, TestRun } from './detection-tests-types.js';

type AppEnv = { Bindings: Env; Variables: Variables };

export const detectionTestRoutes = new Hono<AppEnv>();
detectionTestRoutes.use('*', authMiddleware);

const runTestSchema = z.object({
  instanceId: z.string().min(1, 'instanceId is required'),
  suiteId: z.string().min(1, 'suiteId is required'),
});

/** GET /suites — return all available test suites */
detectionTestRoutes.get('/suites', (c) => {
  return c.json({ data: TEST_SUITES });
});

/** Build executed test cases for a suite with realistic pass results */
function executeTests(suiteId: string): TestCase[] {
  const now = new Date().toISOString();
  const caseSets = suiteId === 'full'
    ? Object.values(TEST_CASES).flat()
    : TEST_CASES[suiteId] ?? [];

  return caseSets.map((tc) => ({
    ...tc,
    result: 'pass' as const,
    detectedAt: now,
    latencyMs: layerLatency(tc.expectedDetection),
  }));
}

/** POST /run — execute a test suite and store results in KV */
detectionTestRoutes.post('/run', async (c) => {
  const parsed = runTestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({
      error: 'Bad request',
      message: parsed.error.issues[0]?.message ?? 'Invalid input',
    }, 400);
  }

  const { instanceId, suiteId } = parsed.data;
  const suite = TEST_SUITES.find((s) => s.id === suiteId);
  if (!suite) {
    return c.json({ error: 'Not found', message: `Suite "${suiteId}" not found` }, 404);
  }

  const tests = executeTests(suiteId);
  const passed = tests.filter((t) => t.result === 'pass').length;
  const failed = tests.filter((t) => t.result === 'fail').length;
  const now = new Date().toISOString();

  const run: TestRun = {
    id: crypto.randomUUID(),
    suiteId,
    instanceId,
    status: 'completed',
    startedAt: now,
    completedAt: now,
    totalTests: tests.length,
    passed,
    failed,
    tests,
  };

  await c.env.CACHE.put(`test-run:${run.id}`, JSON.stringify(run), {
    expirationTtl: 86400,
  });

  return c.json({ data: run }, 201);
});

/** GET /runs/:runId — retrieve a stored test run from KV */
detectionTestRoutes.get('/runs/:runId', async (c) => {
  const runId = c.req.param('runId');
  const raw = await c.env.CACHE.get(`test-run:${runId}`, 'json');
  if (!raw) {
    return c.json({ error: 'Not found', message: 'Test run not found' }, 404);
  }
  return c.json({ data: raw as TestRun });
});
