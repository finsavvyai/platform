import { createMiddleware } from 'hono/factory';
import { eq, and } from 'drizzle-orm';
import { orgMembers, organizations } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Permission, Role } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';

export type AppEnv = { Bindings: Env; Variables: Variables };

/** Permissions allowed in solo mode (no org context). Read-only operations only. */
export const SOLO_ALLOWED_PERMISSIONS = new Set<Permission>([
  'instance.view', 'skill.view', 'policy.view', 'incident.view',
  'alert.view', 'compliance.view', 'member.view', 'billing.view',
  'audit.view', 'cloud.read', 'agent.policy.read', 'marketplace.browse',
  'sla.view', 'saas.read', 'dataroom.view', 'scim.read', 'vault.read',
  'sla.export', 'audit.export',
]);

/** Auto-create a personal org for a user who has none (PLG onboarding). */
export async function autoCreatePersonalOrg(db: Variables['db'], userId: string) {
  try {
    const orgId = generateId();
    const memberId = generateId();
    const now = new Date().toISOString();
    const slug = `personal-${userId.slice(0, 8)}`;
    await db.insert(organizations).values({
      id: orgId, name: 'Personal', slug, ownerId: userId, plan: 'free',
      createdAt: now, updatedAt: now,
    });
    await db.insert(orgMembers).values({
      id: memberId, orgId, userId, role: 'owner',
      status: 'active', invitedAt: now, acceptedAt: now,
    });
    const [member] = await db.select().from(orgMembers)
      .where(eq(orgMembers.id, memberId)).limit(1);
    return member ?? null;
  } catch (err) {
    console.error('[RBAC] Auto-create org failed:', err);
    return null;
  }
}

/** Look up a user's first active org membership (for auto-detect). */
export async function autoDetectOrg(db: Variables['db'], userId: string) {
  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.status, 'active')))
    .limit(1);
  return membership ?? null;
}

/** Set org context variables on the Hono context from a membership row. */
export function setOrgContext(
  c: Parameters<Parameters<typeof createMiddleware<AppEnv>>[0]>[0],
  member: typeof orgMembers.$inferSelect,
) {
  c.set('orgId', member.orgId);
  c.set('role', member.role as Role);
  c.set('orgMember', {
    id: member.id,
    orgId: member.orgId,
    userId: member.userId,
    role: member.role as Role,
    invitedBy: member.invitedBy,
    invitedAt: member.invitedAt,
    acceptedAt: member.acceptedAt,
    status: member.status as 'pending' | 'active' | 'removed',
  });
}

/** Set null org context (solo mode). */
export function setSoloContext(
  c: Parameters<Parameters<typeof createMiddleware<AppEnv>>[0]>[0],
) {
  c.set('orgId', null);
  c.set('role', null);
  c.set('orgMember', null);
}
