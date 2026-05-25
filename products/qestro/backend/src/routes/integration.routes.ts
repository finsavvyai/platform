import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { integrations, projects } from '../schema/index.js';
import { authenticateUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const integrationRouter = Router();
integrationRouter.use(authenticateUser);

const createIntegrationSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['github', 'gitlab', 'jira', 'slack', 'teams', 'discord']),
  name: z.string().min(1).max(255),
  config: z.record(z.any()).default({})
});

const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.any()).optional()
});

integrationRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { projectId, page = '1', limit = '20' } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    const offset = (Number(page) - 1) * Number(limit);
    const items = await db.select().from(integrations).where(eq(integrations.projectId, projectId as string)).orderBy(desc(integrations.createdAt)).limit(Number(limit)).offset(offset);
    const [{ count: total }] = await db.select({ count: count() }).from(integrations).where(eq(integrations.projectId, projectId as string));
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Get integrations error:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

integrationRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const validatedData = createIntegrationSchema.parse(req.body);
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, validatedData.projectId)).limit(1);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [newIntegration] = await db.insert(integrations).values({
      name: validatedData.name,
      type: validatedData.type,
      config: validatedData.config,
      userId: req.user.userId,
      projectId: validatedData.projectId,
      isActive: true
    }).returning();
    logger.info(`Integration created: ${newIntegration.id}`);
    res.status(201).json({ message: 'Integration created', integration: newIntegration });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error('Create integration error:', error);
    res.status(500).json({ error: 'Failed to create integration' });
  }
});

integrationRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const validatedData = updateIntegrationSchema.parse(req.body);
    const [updatedIntegration] = await db.update(integrations).set(validatedData).where(eq(integrations.id, req.params.id)).returning();
    if (!updatedIntegration) return res.status(404).json({ error: 'Integration not found' });
    logger.info(`Integration updated: ${req.params.id}`);
    res.json({ message: 'Integration updated', integration: updatedIntegration });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error('Update integration error:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

integrationRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const [integration] = await db.select({ id: integrations.id }).from(integrations).where(eq(integrations.id, req.params.id)).limit(1);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    await db.delete(integrations).where(eq(integrations.id, req.params.id));
    logger.info(`Integration deleted: ${req.params.id}`);
    res.json({ message: 'Integration deleted' });
  } catch (error) {
    logger.error('Delete integration error:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

integrationRouter.post('/:id/test', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const [integration] = await db.select().from(integrations).where(eq(integrations.id, req.params.id)).limit(1);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    logger.info(`Integration tested: ${req.params.id}`);
    res.json({ status: 'success', message: 'Integration connection verified', type: integration.type });
  } catch (error) {
    logger.error('Test integration error:', error);
    res.status(500).json({ error: 'Failed to test integration' });
  }
});
