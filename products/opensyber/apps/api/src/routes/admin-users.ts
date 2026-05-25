import { Hono } from 'hono';
import { eq, like, or, desc, and, gt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { users, instances, orgMembers } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { adminMiddleware } from '../middleware/admin.js';
import { parseCursor, buildNextCursor, parseLimit } from '../utils/pagination.js';
import { escapeLike } from '../utils/escape-like.js';
import { emitPlatformAudit } from '../lib/platform-audit.js';

const validPlans = ['free', 'personal', 'pro', 'team'] as const;

const patchUserSchema = z.object({
  isSuspended: z.boolean().optional(),
  plan: z.enum(validPlans).optional(),
  isAdmin: z.boolean().optional(),
  name: z.string().min(1).max(255).optional(),
}).strict();

const adminUserRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminUserRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);

// GET /api/admin/users?search=&cursor=&limit=
adminUserRoutes.get('/', async (c) => {
  const db = c.get('db');
  const search = c.req.query('search');
  const cursor = parseCursor(c.req.query('cursor'));
  const limit = parseLimit(c.req.query('limit'));

  const conditions = [];
  if (search) {
    const safe = escapeLike(search);
    conditions.push(or(like(users.name, `%${safe}%`), like(users.email, `%${safe}%`)));
  }
  if (cursor) {
    conditions.push(gt(users.createdAt, cursor.createdAt));
  }

  const rows = await db.select().from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? buildNextCursor(last.createdAt, last.id) : null;

  return c.json({ data, nextCursor, hasMore });
});

// GET /api/admin/users/:id — user detail
adminUserRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return c.json({ error: 'Not Found', message: 'User not found' }, 404);

  const userInstances = await db.select().from(instances).where(eq(instances.userId, id));
  const memberships = await db.select().from(orgMembers).where(eq(orgMembers.userId, id));

  return c.json({ data: { ...user, instances: userInstances, memberships } });
});

// PATCH /api/admin/users/:id — update user (suspend, plan, admin status)
adminUserRoutes.patch('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const parseResult = patchUserSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: 'Validation Error', message: parseResult.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parseResult.data;

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return c.json({ error: 'Not Found', message: 'User not found' }, 404);

  if (body.isAdmin === false && user.isAdmin === 1) {
    const adminCount = await db.select({ count: sql<number>`count(*)` })
      .from(users).where(eq(users.isAdmin, 1));
    if (adminCount[0]!.count <= 1) {
      return c.json({ error: 'Forbidden', message: 'Cannot remove the last admin' }, 400);
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.isSuspended !== undefined) updates.isSuspended = body.isSuspended ? 1 : 0;
  if (body.plan !== undefined) updates.plan = body.plan;
  if (body.isAdmin !== undefined) updates.isAdmin = body.isAdmin ? 1 : 0;
  if (body.name !== undefined) updates.name = body.name;

  await db.update(users).set(updates).where(eq(users.id, id));

  // Admin role changes (grant/revoke) are always auditable, high-signal
  // security events. Emit an audit record regardless of success/failure
  // so that a compromised admin session cannot silently grant additional
  // admins.
  if (body.isAdmin !== undefined && (body.isAdmin ? 1 : 0) !== user.isAdmin) {
    emitPlatformAudit({
      action: 'admin.user.role_change',
      userId: c.get('userId'),
      orgId: c.get('orgId'),
      metadata: {
        targetUserId: id,
        previous: user.isAdmin === 1 ? 'admin' : 'user',
        next: body.isAdmin ? 'admin' : 'user',
      },
    });
  }

  return c.json({
    data: {
      id,
      isSuspended: body.isSuspended ?? (user.isSuspended === 1),
      plan: body.plan ?? user.plan,
      isAdmin: body.isAdmin ?? (user.isAdmin === 1),
    },
  });
});

export { adminUserRoutes };
