import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { orgMembers } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';
import { loadPlanConfig, requirePlanFeature } from '../middleware/plan-enforcement.js';
import { getRiskTrend } from '../services/risk-snapshotter.js';

export const agentRiskTrendRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
agentRiskTrendRoutes.use('*', dbMiddleware, authMiddleware);

/**
 * Validate days query parameter
 */
function validateDaysParam(daysStr: string | undefined): number {
  const days = parseInt(daysStr ?? '30', 10);
  const validDays = [7, 30, 90];
  return validDays.includes(days) ? days : 30;
}

// GET /api/agents/risk-trend — current user's risk trend
agentRiskTrendRoutes.get('/risk-trend', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const days = validateDaysParam(c.req.query('days'));

  // Prefer org-level trend in org context, fallback to user
  const targetUserId = orgId ? undefined : userId;
  const targetOrgId = orgId ?? undefined;

  if (!targetUserId && !targetOrgId) {
    return c.json({ error: 'Bad request', message: 'Unable to determine user context' }, 400);
  }

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  try {
    const trend = await getRiskTrend(db, targetUserId, targetOrgId, {
      startDate,
      limit: days,
    });

    return c.json({
      data: trend,
      meta: {
        count: trend.length,
        days,
        startDate: trend[0]?.date,
        endDate: trend[trend.length - 1]?.date,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to fetch risk trend',
        message: 'An unexpected error occurred',
      },
      500,
    );
  }
});

// GET /api/agents/team/risk-trend — org-level risk trend
const teamTrendRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
teamTrendRoutes.use('*', dbMiddleware, authMiddleware, loadPlanConfig, requirePlanFeature('teamDashboard'), requirePermission('agent.policy.read'));

teamTrendRoutes.get('/risk-trend', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const days = validateDaysParam(c.req.query('days'));

  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required for team view' }, 400);
  }

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  try {
    const trend = await getRiskTrend(db, undefined, orgId, {
      startDate,
      limit: days,
    });

    return c.json({
      data: trend,
      meta: {
        count: trend.length,
        days,
        orgId,
        startDate: trend[0]?.date,
        endDate: trend[trend.length - 1]?.date,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to fetch team risk trend',
        message: 'An unexpected error occurred',
      },
      500,
    );
  }
});

export { teamTrendRoutes };

// GET /api/agents/team/:userId/risk-trend — specific user's trend within org
const teamUserTrendRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
teamUserTrendRoutes.use('*', dbMiddleware, authMiddleware, loadPlanConfig, requirePlanFeature('teamDashboard'), requirePermission('agent.policy.read'));

teamUserTrendRoutes.get('/:userId/risk-trend', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const targetUserId = c.req.param('userId');
  const days = validateDaysParam(c.req.query('days'));

  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required for team view' }, 400);
  }

  // Verify the target user is in this org (RBAC check)
  const [member] = await db
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, targetUserId),
        eq(orgMembers.status, 'active'),
      ),
    )
    .limit(1);

  if (!member) {
    return c.json({ error: 'Not found', message: 'User not found in this organization' }, 404);
  }

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  try {
    const trend = await getRiskTrend(db, targetUserId, undefined, {
      startDate,
      limit: days,
    });

    return c.json({
      data: trend,
      meta: {
        count: trend.length,
        days,
        userId: targetUserId,
        orgId,
        startDate: trend[0]?.date,
        endDate: trend[trend.length - 1]?.date,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to fetch user risk trend',
        message: 'An unexpected error occurred',
      },
      500,
    );
  }
});

export { teamUserTrendRoutes };
