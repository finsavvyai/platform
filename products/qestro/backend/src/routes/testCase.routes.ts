import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, or, ilike, desc, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { testCases, projects } from '../schema/index.js';
import { authenticateUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const testCaseRouter = Router();
testCaseRouter.use(authenticateUser);

const createTestCaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  projectId: z.string().uuid(),
  type: z.enum(['mobile', 'web']).default('web'),
  platform: z.string().optional(),
  testData: z.unknown().default({}),
  expectedResults: z.unknown().optional(),
  tags: z.unknown().optional()
});

const updateTestCaseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  type: z.enum(['mobile', 'web']).optional(),
  platform: z.string().optional(),
  testData: z.unknown().optional(),
  expectedResults: z.unknown().optional(),
  tags: z.unknown().optional(),
  isActive: z.boolean().optional()
});

testCaseRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { projectId, type, search, page = '1', limit = '20' } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [eq(testCases.projectId, projectId as string)];
    if (type) conditions.push(eq(testCases.type, type as any));
    if (search) conditions.push(or(ilike(testCases.name, `%${search}%`), ilike(testCases.description, `%${search}%`)));

    const items = await db.select().from(testCases).where(and(...conditions)).orderBy(desc(testCases.createdAt)).limit(Number(limit)).offset(offset);
    const [{ count: total }] = await db.select({ count: count() }).from(testCases).where(and(...conditions));
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Get test cases error:', error);
    res.status(500).json({ error: 'Failed to fetch test cases' });
  }
});

testCaseRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const validatedData = createTestCaseSchema.parse(req.body);
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, validatedData.projectId)).limit(1);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [newTestCase] = await db.insert(testCases).values({
      name: validatedData.name,
      projectId: validatedData.projectId,
      userId: req.user.userId,
      type: validatedData.type,
      description: validatedData.description,
      platform: validatedData.platform,
      testData: validatedData.testData,
      expectedResults: validatedData.expectedResults,
      tags: validatedData.tags
    }).returning();
    logger.info(`Test case created: ${newTestCase.id}`);
    res.status(201).json({ message: 'Test case created', testCase: newTestCase });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error('Create test case error:', error);
    res.status(500).json({ error: 'Failed to create test case' });
  }
});

testCaseRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const [testCase] = await db.select().from(testCases).where(eq(testCases.id, req.params.id)).limit(1);
    if (!testCase) return res.status(404).json({ error: 'Test case not found' });
    res.json({ testCase });
  } catch (error) {
    logger.error('Get test case error:', error);
    res.status(500).json({ error: 'Failed to fetch test case' });
  }
});

testCaseRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const validatedData = updateTestCaseSchema.parse(req.body);
    const [updatedTestCase] = await db.update(testCases).set({ ...validatedData, updatedAt: new Date() }).where(eq(testCases.id, req.params.id)).returning();
    if (!updatedTestCase) return res.status(404).json({ error: 'Test case not found' });
    logger.info(`Test case updated: ${req.params.id}`);
    res.json({ message: 'Test case updated', testCase: updatedTestCase });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error('Update test case error:', error);
    res.status(500).json({ error: 'Failed to update test case' });
  }
});

testCaseRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const [deleted] = await db.update(testCases).set({ isActive: false, updatedAt: new Date() }).where(eq(testCases.id, req.params.id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Test case not found' });
    logger.info(`Test case deactivated: ${req.params.id}`);
    res.json({ message: 'Test case deleted' });
  } catch (error) {
    logger.error('Delete test case error:', error);
    res.status(500).json({ error: 'Failed to delete test case' });
  }
});

testCaseRouter.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const [sourceTestCase] = await db.select().from(testCases).where(eq(testCases.id, req.params.id)).limit(1);
    if (!sourceTestCase) return res.status(404).json({ error: 'Test case not found' });

    const [duplicatedTestCase] = await db.insert(testCases).values({
      ...sourceTestCase, id: undefined, name: `${sourceTestCase.name} (Copy)`, userId: req.user.userId
    }).returning();
    logger.info(`Test case duplicated: ${req.params.id} -> ${duplicatedTestCase.id}`);
    res.status(201).json({ message: 'Test case duplicated', testCase: duplicatedTestCase });
  } catch (error) {
    logger.error('Duplicate test case error:', error);
    res.status(500).json({ error: 'Failed to duplicate test case' });
  }
});
