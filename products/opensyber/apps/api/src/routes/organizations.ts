import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { organizations, orgMembers, users } from '@opensyber/db';
import { generateId, PLAN_CONFIGS, higherPlan } from '@opensyber/shared';
import type { Plan } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission, resolveOrgContext } from '../middleware/rbac.js';
import { createOrgSchema, updateOrgSchema } from './validation/organizations.js';
import { cascadeDeleteOrg } from '../services/org-cascade-delete.js';

const orgRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

orgRoutes.use('*', dbMiddleware, authMiddleware);

// Create organization
orgRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  // JIT user provisioning is now handled by auth middleware

  const parsed = createOrgSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const { name } = parsed.data;
  const slug = parsed.data.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (existing) {
    return c.json({ error: 'Conflict', message: 'Slug already taken' }, 409);
  }

  const now = new Date().toISOString();
  const orgId = generateId();
  const memberId = generateId();

  await db.batch([
    db.insert(organizations).values({
      id: orgId,
      name,
      slug,
      ownerId: userId,
      plan: 'free',
      maxInstances: 1,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(orgMembers).values({
      id: memberId,
      orgId,
      userId,
      role: 'owner',
      invitedBy: null,
      invitedAt: now,
      acceptedAt: now,
      status: 'active',
    }),
  ]);

  return c.json({ data: { id: orgId, name, slug } }, 201);
});

// List user's organizations
orgRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const memberships = await db
    .select({
      org: organizations,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.status, 'active')));

  const data = memberships.map(({ org, role }) => ({
    ...org,
    currentUserRole: role,
  }));

  return c.json({ data });
});

// Get organization details
orgRoutes.get('/:orgId', resolveOrgContext, async (c) => {
  const db = c.get('db');
  const orgId = c.req.param('orgId');

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) {
    return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);
  }

  const memberRows = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.status, 'active')));

  // Enrich with user name/email
  const members = await Promise.all(
    memberRows.map(async (m) => {
      const [user] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, m.userId))
        .limit(1);
      return { userId: m.userId, role: m.role, acceptedAt: m.acceptedAt, name: user?.name ?? null, email: user?.email ?? '' };
    }),
  );

  // Compute effective plan: use higher of org plan and owner's user plan.
  // Handles case where LemonSqueezy webhook updated users.plan but not organizations.plan.
  const userId = c.get('userId');
  const [currentUser] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const orgPlan = (org.plan ?? 'free') as Plan;
  const userPlan = (currentUser?.plan ?? 'free') as Plan;
  const effectivePlan = higherPlan(orgPlan, userPlan);
  const effectiveMaxInstances = PLAN_CONFIGS[effectivePlan]?.instanceLimit ?? org.maxInstances;

  return c.json({
    data: {
      ...org,
      plan: effectivePlan,
      maxInstances: effectiveMaxInstances,
      members,
      memberCount: members.length,
    },
  });
});

// Update organization
orgRoutes.patch('/:orgId', requirePermission('org.update'), async (c) => {
  const db = c.get('db');
  const orgId = c.req.param('orgId');
  const parsed = updateOrgSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const { name } = parsed.data;

  await db
    .update(organizations)
    .set({ name, updatedAt: new Date().toISOString() })
    .where(eq(organizations.id, orgId));

  return c.json({ data: { id: orgId, name } });
});

// Delete organization (owner only) — cascades to related records
orgRoutes.delete('/:orgId', requirePermission('org.delete'), async (c) => {
  const db = c.get('db');
  const orgId = c.req.param('orgId');

  await cascadeDeleteOrg(db, orgId);

  return c.json({ data: { deleted: true } });
});

export { orgRoutes };
