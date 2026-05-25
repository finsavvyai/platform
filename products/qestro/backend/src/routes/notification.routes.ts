import { Router, Request, Response } from 'express';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { notificationLogs } from '../schema/index.js';
import { authenticateUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const notificationRouter = Router();

// Apply auth to all routes
notificationRouter.use(authenticateUser);

// GET / - list notification logs with pagination
notificationRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { page = '1', limit = '20', status, type } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions: any[] = [];
    if (status) conditions.push(eq(notificationLogs.status, status as string));
    if (type) conditions.push(eq(notificationLogs.type, type as string));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(notificationLogs)
      .where(whereClause)
      .orderBy(desc(notificationLogs.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(notificationLogs)
      .where(whereClause);

    res.json({
      items,
      total: totalResult?.count || 0,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    logger.error('Get notification logs error:', error);
    res.status(500).json({ error: 'Failed to fetch notification logs' });
  }
});

// GET /:id - get single notification log
notificationRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [log] = await db
      .select()
      .from(notificationLogs)
      .where(eq(notificationLogs.id, req.params.id))
      .limit(1);

    if (!log) {
      return res.status(404).json({ error: 'Notification log not found' });
    }

    res.json({ log });
  } catch (error) {
    logger.error('Get notification log error:', error);
    res.status(500).json({ error: 'Failed to fetch notification log' });
  }
});

// DELETE /:id - soft delete by marking failed
notificationRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [log] = await db
      .select()
      .from(notificationLogs)
      .where(eq(notificationLogs.id, req.params.id))
      .limit(1);

    if (!log) {
      return res.status(404).json({ error: 'Notification log not found' });
    }

    await db
      .update(notificationLogs)
      .set({ status: 'failed', error: 'Deleted by user' })
      .where(eq(notificationLogs.id, req.params.id));

    logger.info(`Notification log deleted: ${req.params.id}`);

    res.json({ message: 'Notification log deleted' });
  } catch (error) {
    logger.error('Delete notification log error:', error);
    res.status(500).json({ error: 'Failed to delete notification log' });
  }
});
