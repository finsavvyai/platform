import { createMiddleware } from 'hono/factory';
import { eq, and } from 'drizzle-orm';
import { orgMembers, customRoles } from '@opensyber/db';
import { hasPermission, isBuiltInRole } from '@opensyber/shared';
import type { Permission } from '@opensyber/shared';
import {
  type AppEnv,
  SOLO_ALLOWED_PERMISSIONS,
  autoCreatePersonalOrg,
  autoDetectOrg,
  setOrgContext,
  setSoloContext,
} from './rbac-helpers.js';

/**
 * RBAC middleware factory.
 *
 * Usage: `requirePermission('instance.create')`
 *
 * Reads X-Org-Id header to determine org context:
 * - null/missing: solo mode, only read permissions allowed
 * - present: lookup membership, check role has permission
 */
export function requirePermission(permission: Permission) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const orgId = c.get('orgId') ?? c.req.header('X-Org-Id') ?? null;

    if (!orgId) {
      if (SOLO_ALLOWED_PERMISSIONS.has(permission)) {
        setSoloContext(c);
        return next();
      }
      const userId = c.get('userId');
      const db = c.get('db');
      const autoMember = await autoDetectOrg(db, userId);
      if (!autoMember) {
        return c.json(
          { error: 'Forbidden', message: 'Create an organization first, or provide X-Org-Id header' },
          403,
        );
      }
      setOrgContext(c, autoMember);
      const autoRole = autoMember.role;
      if (isBuiltInRole(autoRole) && !hasPermission(autoRole, permission)) {
        return c.json({ error: 'Forbidden', message: `Role '${autoRole}' does not have '${permission}' permission` }, 403);
      }
      return next();
    }

    const userId = c.get('userId');
    const db = c.get('db');

    const [member] = await db
      .select()
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, orgId),
          eq(orgMembers.userId, userId),
          eq(orgMembers.status, 'active'),
        ),
      )
      .limit(1);

    if (!member) {
      return c.json(
        { error: 'Forbidden', message: 'You are not a member of this organization' },
        403,
      );
    }

    const roleValue = member.role;

    if (isBuiltInRole(roleValue)) {
      if (!hasPermission(roleValue, permission)) {
        return c.json(
          { error: 'Forbidden', message: `Role '${roleValue}' does not have '${permission}' permission` },
          403,
        );
      }
    } else {
      const [custom] = await db
        .select({ permissions: customRoles.permissions })
        .from(customRoles)
        .where(and(eq(customRoles.id, roleValue), eq(customRoles.orgId, orgId)))
        .limit(1);

      if (!custom) {
        return c.json({ error: 'Forbidden', message: 'Unknown role' }, 403);
      }

      const perms: string[] = JSON.parse(custom.permissions);
      if (!perms.includes(permission)) {
        return c.json(
          { error: 'Forbidden', message: `Custom role does not have '${permission}' permission` },
          403,
        );
      }
    }

    setOrgContext(c, member);
    return next();
  });
}

/**
 * Lightweight org context resolver (no permission check).
 * Reads X-Org-Id header; if missing, falls through to solo mode.
 */
export const resolveOrgContext = createMiddleware<AppEnv>(async (c, next) => {
  const orgId = c.req.header('X-Org-Id') ?? null;

  if (!orgId) {
    setSoloContext(c);
    if (c.env.ENVIRONMENT === 'development') {
      console.log(JSON.stringify({
        event: 'rbac.solo_bypass',
        userId: c.get('userId'),
        permission: null,
        path: c.req.path,
        method: c.req.method,
        timestamp: new Date().toISOString(),
      }));
    }
    return next();
  }

  const userId = c.get('userId');
  const db = c.get('db');

  const [member] = await db
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, userId),
        eq(orgMembers.status, 'active'),
      ),
    )
    .limit(1);

  if (!member) {
    return c.json(
      { error: 'Forbidden', message: 'You are not a member of this organization' },
      403,
    );
  }

  setOrgContext(c, member);
  return next();
});

/**
 * Org context resolver with auto-detection.
 * When X-Org-Id header is missing, queries user's first active org membership.
 * Use on routes that require org context (agent policies, alert channels, OASF).
 */
export const resolveOrgContextAutoDetect = createMiddleware<AppEnv>(async (c, next) => {
  const orgId = c.req.header('X-Org-Id') ?? null;
  const userId = c.get('userId');
  const db = c.get('db');

  if (!orgId) {
    let member = await autoDetectOrg(db, userId);
    if (!member) {
      member = await autoCreatePersonalOrg(db, userId);
    }
    if (member) {
      setOrgContext(c, member);
      return next();
    }
    setSoloContext(c);
    return next();
  }

  const [member] = await db
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, userId),
        eq(orgMembers.status, 'active'),
      ),
    )
    .limit(1);

  if (!member) {
    return c.json(
      { error: 'Forbidden', message: 'You are not a member of this organization' },
      403,
    );
  }

  setOrgContext(c, member);
  return next();
});
