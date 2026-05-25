import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { testRuns, testResults, projects } from '../schema/index.js';
import { authenticateUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const testRunRouter = Router();
testRunRouter.use(authenticateUser);

const createTestRunSchema = z.object({
  projectId: z.string().uuid(),
  testPlanId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  environment: z.string().max(100).optional(),
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  testCaseIds: z.array(z.string().uuid()).optional()
});

testRunRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { projectId, testPlanId, status, page = '1', limit = '20' } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [eq(testRuns.projectId, projectId as string)];
    if (testPlanId) conditions.push(eq(testRuns.testSuiteId, testPlanId as string));
    if (status) conditions.push(eq(testRuns.status, status as any));

    const items = await db.select().from(testRuns).where(and(...conditions)).orderBy(desc(testRuns.createdAt)).limit(Number(limit)).offset(offset);
    const [{ count: total }] = await db.select({ count: count() }).from(testRuns).where(and(...conditions));
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Get test runs error:', error);
    res.status(500).json({ error: 'Failed to fetch test runs' });
  }
});

testRunRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const validatedData = createTestRunSchema.parse(req.body);
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, validatedData.projectId)).limit(1);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [newTestRun] = await db.insert(testRuns).values({
      projectId: validatedData.projectId,
      userId: req.user.userId,
      testSuiteId: validatedData.testPlanId,
      status: 'pending',
      environment: validatedData.environment
    }).returning();
    logger.info(`Test run created: ${newTestRun.id}`);
    res.status(201).json({ message: 'Test run started', testRun: newTestRun });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error('Create test run error:', error);
    res.status(500).json({ error: 'Failed to start test run' });
  }
});

testRunRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const [testRun] = await db.select().from(testRuns).where(eq(testRuns.id, req.params.id)).limit(1);
    if (!testRun) return res.status(404).json({ error: 'Test run not found' });

    const results = await db.select().from(testResults).where(eq(testResults.runId, req.params.id));
    res.json({ testRun, results, resultCount: results.length });
  } catch (error) {
    logger.error('Get test run error:', error);
    res.status(500).json({ error: 'Failed to fetch test run' });
  }
});

testRunRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const [testRun] = await db.select().from(testRuns).where(eq(testRuns.id, req.params.id)).limit(1);
    if (!testRun) return res.status(404).json({ error: 'Test run not found' });

    if (testRun.status !== 'pending' && testRun.status !== 'running') {
      return res.status(400).json({ error: 'Cannot cancel test run', status: testRun.status });
    }

    const [updated] = await db.update(testRuns).set({ status: 'cancelled', endTime: new Date() }).where(eq(testRuns.id, req.params.id)).returning();
    logger.info(`Test run cancelled: ${req.params.id}`);
    res.json({ message: 'Test run cancelled', testRun: updated });
  } catch (error) {
    logger.error('Cancel test run error:', error);
    res.status(500).json({ error: 'Failed to cancel test run' });
  }
});

testRunRouter.get('/:id/results', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { page = '1', limit = '20' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [testRun] = await db.select({ id: testRuns.id }).from(testRuns).where(eq(testRuns.id, req.params.id)).limit(1);
    if (!testRun) return res.status(404).json({ error: 'Test run not found' });

    const results = await db.select().from(testResults).where(eq(testResults.runId, req.params.id)).orderBy(desc(testResults.createdAt)).limit(Number(limit)).offset(offset);
    const [{ count: total }] = await db.select({ count: count() }).from(testResults).where(eq(testResults.runId, req.params.id));
    res.json({ results, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Get test results error:', error);
    res.status(500).json({ error: 'Failed to fetch test results' });
  }
});
