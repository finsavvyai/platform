import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { projects } from '../schema/index.js';
import { authenticateUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const projectRouter = Router();

projectRouter.use(authenticateUser);

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name required').max(255),
  description: z.string().max(1000).optional(),
  type: z.enum(['mobile', 'web', 'hybrid']).default('web'),
  platform: z.string().max(50).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  type: z.enum(['mobile', 'web', 'hybrid']).optional(),
  platform: z.string().max(50).optional(),
  settings: z.record(z.unknown()).optional(),
});

// GET /
projectRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const projectsList = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        type: projects.type,
        platform: projects.platform,
        isActive: projects.isActive,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.userId, req.user.userId))
      .orderBy(sql`created_at DESC`);

    res.json({ projects: projectsList, total: projectsList.length });
  } catch (error) {
    logger.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /
projectRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = createProjectSchema.parse(req.body);

    const [newProject] = await db
      .insert(projects)
      .values({
        userId: req.user.userId,
        name: validatedData.name,
        description: validatedData.description || '',
        type: validatedData.type,
        platform: validatedData.platform,
      })
      .returning();

    res.status(201).json(newProject);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /:id
projectRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, req.params.id),
        eq(projects.userId, req.user.userId)
      ))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    logger.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// PUT /:id
projectRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = updateProjectSchema.parse(req.body);

    const [updatedProject] = await db
      .update(projects)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(and(
        eq(projects.id, req.params.id),
        eq(projects.userId, req.user.userId)
      ))
      .returning();

    if (!updatedProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(updatedProject);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /:id (soft delete)
projectRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [deactivated] = await db
      .update(projects)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(projects.id, req.params.id),
        eq(projects.userId, req.user.userId)
      ))
      .returning();

    if (!deactivated) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project deactivated', id: deactivated.id });
  } catch (error) {
    logger.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});
