import { Router, Request, Response } from 'express';
import { desc, count, sql, eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  users,
  projects,
  testRuns,
  securityAuditLogs
} from '../schema/index.js';
import { subscriptions } from '../schema/payment-schema.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const adminRouter = Router();

// Apply auth to all routes
adminRouter.use(authenticateUser);

// GET /users - list all users (admin only)
adminRouter.get('/users', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const items = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        subscription: users.subscription,
        isEmailVerified: users.isEmailVerified,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(users);

    logger.info(`Admin fetched users list`);

    res.json({
      items,
      total: totalResult?.count || 0,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /stats - platform stats (admin only)
adminRouter.get('/stats', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    // Total users
    const [totalUsersResult] = await db.select({ count: count() }).from(users);

    // Total projects
    const [totalProjectsResult] = await db.select({ count: count() }).from(projects);

    // Total test runs
    const [totalRunsResult] = await db.select({ count: count() }).from(testRuns);

    // Subscriptions breakdown
    const subscriptionStats = await db
      .select({
        planId: subscriptions.planId,
        count: count()
      })
      .from(subscriptions)
      .groupBy(subscriptions.planId);

    // Active users (logged in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [activeUsersResult] = await db
      .select({ count: count() })
      .from(users)
      .where(sql`last_login_at >= ${thirtyDaysAgo}`);

    logger.info(`Admin fetched platform stats`);

    res.json({
      totalUsers: totalUsersResult?.count || 0,
      totalProjects: totalProjectsResult?.count || 0,
      totalTestRuns: totalRunsResult?.count || 0,
      activeUsers30Days: activeUsersResult?.count || 0,
      subscriptionBreakdown: subscriptionStats
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /audit-log - list audit log entries (admin only)
adminRouter.get('/audit-log', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', eventType, resourceType } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions: any[] = [];
    if (eventType && typeof eventType === 'string') {
      conditions.push(eq(securityAuditLogs.eventType, eventType));
    }
    if (resourceType && typeof resourceType === 'string') {
      conditions.push(eq(securityAuditLogs.resourceType, resourceType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(securityAuditLogs)
      .where(whereClause)
      .orderBy(desc(securityAuditLogs.timestamp))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(securityAuditLogs).where(whereClause);

    logger.info(`Admin fetched audit logs`);

    res.json({
      items,
      total: totalResult?.count || 0,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    logger.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});
