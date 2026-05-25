import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { scheduledTests, dataSources, projects } from '../schema/index.js';
import { authenticateUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const automationRouter = Router();

// All automation routes require authentication
automationRouter.use(authenticateUser);

// GET /scheduled - list scheduled tests
automationRouter.get('/scheduled', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const schema = z.object({
      status: z.string().optional(),
      page: z.string().transform(Number).default('1'),
      limit: z.string().transform(Number).default('20'),
    });

    const query = schema.parse(req.query);
    const offset = (query.page - 1) * query.limit;

    const conditions = [eq(scheduledTests.userId, req.user.userId)];
    if (query.status) {
      conditions.push(eq(scheduledTests.status, query.status));
    }

    const scheduled = await db
      .select()
      .from(scheduledTests)
      .where(and(...conditions))
      .orderBy(desc(scheduledTests.nextRun))
      .limit(query.limit)
      .offset(offset);

    const [{ count: total }] = await db
      .select({ count: count() })
      .from(scheduledTests)
      .where(and(...conditions));

    res.json({ scheduled, total, page: query.page, limit: query.limit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Get scheduled error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled tests' });
  }
});

// POST /scheduled - create scheduled test
automationRouter.post('/scheduled', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const schema = z.object({
      dataSourceId: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional(),
      testType: z.string(),
      config: z.record(z.any()),
      schedule: z.record(z.any()),
      alerts: z.record(z.any()),
      thresholds: z.record(z.any()).optional(),
    });

    const validatedData = schema.parse(req.body);

    // Verify datasource exists
    const [dataSource] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.id, validatedData.dataSourceId))
      .limit(1);

    if (!dataSource) {
      return res.status(404).json({ error: 'Data source not found' });
    }

    const [scheduled] = await db
      .insert(scheduledTests)
      .values({
        userId: req.user.userId,
        dataSourceId: validatedData.dataSourceId,
        name: validatedData.name,
        description: validatedData.description,
        testType: validatedData.testType,
        config: validatedData.config,
        schedule: validatedData.schedule,
        alerts: validatedData.alerts,
        thresholds: validatedData.thresholds || {},
        status: 'active',
      })
      .returning();

    logger.info(`Scheduled test created: ${scheduled.id}`);

    res.status(201).json({ scheduled });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Create scheduled error:', error);
    res.status(500).json({ error: 'Failed to create scheduled test' });
  }
});

// GET /scheduled/:id - get scheduled test details
automationRouter.get('/scheduled/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [scheduled] = await db
      .select()
      .from(scheduledTests)
      .where(eq(scheduledTests.id, req.params.id))
      .limit(1);

    if (!scheduled) {
      return res.status(404).json({ error: 'Scheduled test not found' });
    }

    res.json({ scheduled });
  } catch (error) {
    logger.error('Get scheduled test error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled test' });
  }
});

// PUT /scheduled/:id - update scheduled test
automationRouter.put('/scheduled/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const schema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      config: z.record(z.any()).optional(),
      schedule: z.record(z.any()).optional(),
      alerts: z.record(z.any()).optional(),
      thresholds: z.record(z.any()).optional(),
      status: z.string().optional(),
    });

    const validatedData = schema.parse(req.body);

    const [updated] = await db
      .update(scheduledTests)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(scheduledTests.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Scheduled test not found' });
    }

    logger.info(`Scheduled test updated: ${req.params.id}`);

    res.json({ scheduled: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Update scheduled error:', error);
    res.status(500).json({ error: 'Failed to update scheduled test' });
  }
});

// DELETE /scheduled/:id - delete scheduled test
automationRouter.delete('/scheduled/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await db
      .delete(scheduledTests)
      .where(eq(scheduledTests.id, req.params.id));

    logger.info(`Scheduled test deleted: ${req.params.id}`);

    res.json({ message: 'Scheduled test deleted' });
  } catch (error) {
    logger.error('Delete scheduled error:', error);
    res.status(500).json({ error: 'Failed to delete scheduled test' });
  }
});
