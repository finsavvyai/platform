import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { testSuites as testPlans, projects } from '../schema/index.js';
import { authenticateUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const testPlanRouter = Router();
testPlanRouter.use(authenticateUser);

const createTestPlanSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  type: z.string().default('web')
});

const updateTestPlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  type: z.string().optional(),
  isActive: z.boolean().optional()
});

testPlanRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { projectId, isActive, page = '1', limit = '20' } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [eq(testPlans.projectId, projectId as string)];
    if (isActive !== undefined) conditions.push(eq(testPlans.isActive, isActive === 'true'));

    const items = await db.select().from(testPlans).where(and(...conditions)).orderBy(desc(testPlans.createdAt)).limit(Number(limit)).offset(offset);
    const [{ count: total }] = await db.select({ count: count() }).from(testPlans).where(and(...conditions));
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Get test plans error:', error);
    res.status(500).json({ error: 'Failed to fetch test plans' });
  }
});

testPlanRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const validatedData = createTestPlanSchema.parse(req.body);
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, validatedData.projectId)).limit(1);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [newTestPlan] = await db.insert(testPlans).values({
      projectId: validatedData.projectId,
      userId: req.user.userId,
      name: validatedData.name,
      description: validatedData.description,
      type: validatedData.type,
      isActive: true
    }).returning();
    logger.info(`Test plan created: ${newTestPlan.id}`);
    res.status(201).json({ message: 'Test plan created', testPlan: newTestPlan });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error('Create test plan error:', error);
    res.status(500).json({ error: 'Failed to create test plan' });
  }
});

testPlanRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const [testPlan] = await db.select().from(testPlans).where(eq(testPlans.id, req.params.id)).limit(1);
    if (!testPlan) return res.status(404).json({ error: 'Test plan not found' });
    res.json({ testPlan });
  } catch (error) {
    logger.error('Get test plan error:', error);
    res.status(500).json({ error: 'Failed to fetch test plan' });
  }
});

testPlanRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const validatedData = updateTestPlanSchema.parse(req.body);
    const [updatedTestPlan] = await db.update(testPlans).set({ ...validatedData, updatedAt: new Date() }).where(eq(testPlans.id, req.params.id)).returning();
    if (!updatedTestPlan) return res.status(404).json({ error: 'Test plan not found' });
    logger.info(`Test plan updated: ${req.params.id}`);
    res.json({ message: 'Test plan updated', testPlan: updatedTestPlan });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error('Update test plan error:', error);
    res.status(500).json({ error: 'Failed to update test plan' });
  }
});

testPlanRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const [deleted] = await db.update(testPlans).set({ isActive: false, updatedAt: new Date() }).where(eq(testPlans.id, req.params.id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Test plan not found' });
    logger.info(`Test plan deactivated: ${req.params.id}`);
    res.json({ message: 'Test plan deleted' });
  } catch (error) {
    logger.error('Delete test plan error:', error);
    res.status(500).json({ error: 'Failed to delete test plan' });
  }
});
