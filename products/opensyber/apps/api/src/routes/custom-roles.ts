import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { customRoles, orgMembers } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';
import { createCustomRoleSchema, updateCustomRoleSchema } from './validation/custom-roles.js';

const customRoleRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

customRoleRoutes.use('*', dbMiddleware, authMiddleware);

/** GET /:orgId/roles — list custom roles for org */
customRoleRoutes.get(
  '/:orgId/roles',
  requirePermission('member.view'),
  async (c) => {
    const db = c.get('db');
    const orgId = c.req.param('orgId');

    const roles = await db
      .select()
      .from(customRoles)
      .where(eq(customRoles.orgId, orgId))
      .orderBy(desc(customRoles.createdAt));

    const parsed = roles.map((r) => ({
      ...r,
      permissions: JSON.parse(r.permissions) as string[],
      isDefault: r.isDefault === 1,
    }));

    return c.json({ data: parsed });
  },
);

/** POST /:orgId/roles — create custom role */
customRoleRoutes.post(
  '/:orgId/roles',
  requirePermission('member.changeRole'),
  async (c) => {
    const db = c.get('db');
    const orgId = c.req.param('orgId');
    const body = await c.req.json();
    const parsed = createCustomRoleSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
    }

    const { name, description, permissions, isDefault } = parsed.data;

    const id = generateId();
    const now = new Date().toISOString();

    await db.insert(customRoles).values({
      id,
      orgId,
      name,
      description: description ?? null,
      permissions: JSON.stringify(permissions),
      isDefault: isDefault ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });

    return c.json(
      { data: { id, orgId, name, description, permissions, isDefault: isDefault ?? false } },
      201,
    );
  },
);

/** PATCH /:orgId/roles/:roleId — update custom role */
customRoleRoutes.patch(
  '/:orgId/roles/:roleId',
  requirePermission('member.changeRole'),
  async (c) => {
    const db = c.get('db');
    const orgId = c.req.param('orgId');
    const roleId = c.req.param('roleId');
    const body = await c.req.json();
    const parsed = updateCustomRoleSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
    }

    const [existing] = await db
      .select()
      .from(customRoles)
      .where(and(eq(customRoles.id, roleId), eq(customRoles.orgId, orgId)))
      .limit(1);

    if (!existing) {
      return c.json({ error: 'Not Found', message: 'Custom role not found' }, 404);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.permissions !== undefined) updates.permissions = JSON.stringify(parsed.data.permissions);
    if (parsed.data.isDefault !== undefined) updates.isDefault = parsed.data.isDefault ? 1 : 0;

    await db.update(customRoles).set(updates).where(eq(customRoles.id, roleId));

    return c.json({ data: { id: roleId, ...parsed.data } });
  },
);

/** DELETE /:orgId/roles/:roleId — delete custom role (only if unused) */
customRoleRoutes.delete(
  '/:orgId/roles/:roleId',
  requirePermission('member.changeRole'),
  async (c) => {
    const db = c.get('db');
    const orgId = c.req.param('orgId');
    const roleId = c.req.param('roleId');

    const [existing] = await db
      .select()
      .from(customRoles)
      .where(and(eq(customRoles.id, roleId), eq(customRoles.orgId, orgId)))
      .limit(1);

    if (!existing) {
      return c.json({ error: 'Not Found', message: 'Custom role not found' }, 404);
    }

    // Check if any members use this role
    const members = await db
      .select({ id: orgMembers.id })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, roleId)))
      .limit(1);

    if (members.length > 0) {
      return c.json(
        { error: 'Conflict', message: 'Cannot delete role while members are assigned to it' },
        409,
      );
    }

    await db.delete(customRoles).where(eq(customRoles.id, roleId));

    return new Response(null, { status: 204 });
  },
);

export { customRoleRoutes };
