import { Hono } from 'hono';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { agentActivity, agentRiskSnapshots, orgMembers } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';
import { loadPlanConfig } from '../middleware/plan-enforcement.js';

const agentTeamUserRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply middleware
agentTeamUserRoutes.use('*', dbMiddleware, authMiddleware, loadPlanConfig);
agentTeamUserRoutes.use('*', requirePermission('agent.policy.read'));

/**
 * GET /api/agents/team/:userId/activity
 * Get paginated activity events for a specific user in the org
 */
agentTeamUserRoutes.get('/team/:userId/activity', async (c) => {
  const targetUserId = c.req.param('userId');
  const orgId = c.get('orgId');
  const db = c.get('db');

  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required' }, 400);
  }

  // Verify target user is in the same org
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
    return c.json(
      { error: 'Forbidden', message: 'User is not a member of this organization' },
      403,
    );
  }

  // Parse query params
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100', 10), 500);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const since = c.req.query('since');

  // Build where clause
  const whereClause = since
    ? and(
        eq(agentActivity.orgId, orgId),
        eq(agentActivity.userId, targetUserId),
        gte(agentActivity.createdAt, since),
      )
    : and(
        eq(agentActivity.orgId, orgId),
        eq(agentActivity.userId, targetUserId),
      );

  const events = await db
    .select()
    .from(agentActivity)
    .where(whereClause)
    .orderBy(desc(agentActivity.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ data: events, hasMore: events.length === limit });
});

/**
 * GET /api/agents/team/:userId/risk-trend
 * Get risk trend data for a specific user within the org
 */
agentTeamUserRoutes.get('/team/:userId/risk-trend', async (c) => {
  const targetUserId = c.req.param('userId');
  const orgId = c.get('orgId');
  const db = c.get('db');

  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required' }, 400);
  }

  // Verify target user is in the same org
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
    return c.json(
      { error: 'Forbidden', message: 'User is not a member of this organization' },
      403,
    );
  }

  // Parse days query param
  const daysParam = c.req.query('days');
  const days = ['7', '30', '90'].includes(daysParam ?? '') ? parseInt(daysParam!, 10) : 30;

  // Get snapshots for the user within the date range
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffIso = cutoffDate.toISOString().split('T')[0] ?? '';

  const snapshots = await db
    .select()
    .from(agentRiskSnapshots)
    .where(
      and(
        eq(agentRiskSnapshots.userId, targetUserId),
        gte(agentRiskSnapshots.snapshotDate, cutoffIso),
      ),
    )
    .orderBy(agentRiskSnapshots.snapshotDate);

  return c.json({
    data: snapshots.map((s) => ({
      date: s.snapshotDate,
      agentScore: s.agentScore,
      cspmScore: s.cspmScore,
      combinedScore: s.combinedScore,
      grade: s.grade,
    })),
  });
});

export { agentTeamUserRoutes };
