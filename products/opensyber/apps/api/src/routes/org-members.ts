import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { orgMembers, organizations } from '@opensyber/db';
import { isHigherRole } from '@opensyber/shared';
import type { Role } from '@opensyber/shared';

const changeRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'security', 'developer', 'viewer']),
});
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';

const orgMemberRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

orgMemberRoutes.use('*', dbMiddleware, authMiddleware);

// Change member role
orgMemberRoutes.patch(
  '/:orgId/members/:memberId',
  requirePermission('member.changeRole'),
  async (c) => {
    const db = c.get('db');
    const currentRole = c.get('role');
    const memberId = c.req.param('memberId');
    const parsed = changeRoleSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'Invalid input' }, 400);
    }
    const newRole = parsed.data.role as Role;

    // Prevent escalation: cannot assign a role higher than your own
    if (currentRole && isHigherRole(newRole, currentRole)) {
      return c.json(
        { error: 'Forbidden', message: 'Cannot assign a role higher than your own' },
        403,
      );
    }

    // Cannot change owner role
    const [target] = await db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(eq(orgMembers.id, memberId))
      .limit(1);

    if (!target) {
      return c.json({ error: 'Not Found', message: 'Member not found' }, 404);
    }

    if (target.role === 'owner') {
      return c.json(
        { error: 'Forbidden', message: 'Cannot change the owner role directly' },
        403,
      );
    }

    await db
      .update(orgMembers)
      .set({ role: newRole })
      .where(eq(orgMembers.id, memberId));

    return c.json({ data: { id: memberId, role: newRole } });
  },
);

// Remove member
orgMemberRoutes.delete(
  '/:orgId/members/:memberId',
  requirePermission('member.remove'),
  async (c) => {
    const db = c.get('db');
    const memberId = c.req.param('memberId');

    const [target] = await db
      .select({ role: orgMembers.role, userId: orgMembers.userId })
      .from(orgMembers)
      .where(eq(orgMembers.id, memberId))
      .limit(1);

    if (!target) {
      return c.json({ error: 'Not Found', message: 'Member not found' }, 404);
    }

    if (target.role === 'owner') {
      return c.json(
        { error: 'Forbidden', message: 'Cannot remove the organization owner' },
        403,
      );
    }

    await db
      .update(orgMembers)
      .set({ status: 'removed' })
      .where(eq(orgMembers.id, memberId));

    return c.json({ data: { removed: true } });
  },
);

// Transfer ownership
orgMemberRoutes.post(
  '/:orgId/members/:memberId/transfer',
  requirePermission('org.delete'), // only owner can transfer
  async (c) => {
    const db = c.get('db');
    const orgId = c.req.param('orgId');
    const memberId = c.req.param('memberId');
    const currentMember = c.get('orgMember');

    if (!currentMember) {
      return c.json({ error: 'Forbidden', message: 'No org context' }, 403);
    }

    const [target] = await db
      .select()
      .from(orgMembers)
      .where(
        and(eq(orgMembers.id, memberId), eq(orgMembers.status, 'active')),
      )
      .limit(1);

    if (!target) {
      return c.json({ error: 'Not Found', message: 'Member not found' }, 404);
    }

    const now = new Date().toISOString();

    await db.batch([
      // Promote target to owner
      db.update(orgMembers).set({ role: 'owner' }).where(eq(orgMembers.id, memberId)),
      // Demote current owner to admin
      db
        .update(orgMembers)
        .set({ role: 'admin' })
        .where(eq(orgMembers.id, currentMember.id)),
      // Update org ownerId
      db
        .update(organizations)
        .set({ ownerId: target.userId, updatedAt: now })
        .where(eq(organizations.id, orgId)),
    ]);

    return c.json({ data: { newOwnerId: target.userId } });
  },
);

export { orgMemberRoutes };
