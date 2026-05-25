/**
 * Agent Activity Related Findings Routes
 *
 * Provides CSPM findings related to agent activity events
 * through heuristic cross-linkage.
 */

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { agentActivity } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { hasPermission } from '@opensyber/shared';
import { findRelatedFindings } from '../services/activity-cspm-linker.js';

export const agentActivityFindingsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

agentActivityFindingsRoutes.use(
  '*',
  dbMiddleware,
  authMiddleware,
  resolveOrgContext,
);

/**
 * GET /api/activity/:activityId/related-findings
 *
 * Returns CSPM findings related to an agent activity event.
 * Uses heuristic matching to correlate activity with security findings.
 */
agentActivityFindingsRoutes.get(
  '/:activityId/related-findings',
  async (c) => {
    const role = c.get('role');
    if (role && !hasPermission(role, 'agent.policy.read')) {
      return c.json(
        { error: 'Forbidden', message: 'agent.policy.read required' },
        403,
      );
    }

    const db = c.get('db');
    const userId = c.get('userId');
    const orgId = c.get('orgId');
    const activityId = c.req.param('activityId');

    // Fetch the activity and verify ownership
    const condition = orgId
      ? and(eq(agentActivity.id, activityId), eq(agentActivity.orgId, orgId))
      : and(eq(agentActivity.id, activityId), eq(agentActivity.userId, userId));

    const [activity] = await db
      .select()
      .from(agentActivity)
      .where(condition)
      .limit(1);

    if (!activity) {
      return c.json({ error: 'Not found', message: 'Activity not found' }, 404);
    }

    // Find related CSPM findings
    const findings = await findRelatedFindings(
      db,
      activity as any,
      orgId,
    );

    return c.json({ data: findings });
  },
);
