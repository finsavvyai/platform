/**
 * TokenForge ZTNA — CRUD API for tf_ztna_apps.
 *
 * Manages the policy table consumed by apps/ztna-proxy. Each row maps a
 * public hostname → upstream origin with a per-app required trust score.
 *
 *   GET    /api/ztna/apps              list apps for current org/user
 *   POST   /api/ztna/apps              create
 *   PATCH  /api/ztna/apps/:id          update mutable fields
 *   DELETE /api/ztna/apps/:id          soft-delete (status='deleted')
 */

import { Hono } from 'hono';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { generateId } from '@opensyber/shared';
import { tfZtnaApps } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';

export const ztnaAppRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
ztnaAppRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const createSchema = z.object({
  hostname: z.string().regex(HOSTNAME_RE, 'Must be a valid hostname'),
  upstream: z.string().url('Upstream must be a valid URL'),
  requiredTrustScore: z.number().int().min(30).max(100).default(70),
  forwardWriteMethods: z.boolean().default(true),
});

const updateSchema = z.object({
  upstream: z.string().url().optional(),
  requiredTrustScore: z.number().int().min(30).max(100).optional(),
  forwardWriteMethods: z.boolean().optional(),
  status: z.enum(['active', 'paused']).optional(),
});

function ownerCondition(orgId: string | null, userId: string) {
  return orgId ? eq(tfZtnaApps.orgId, orgId) : eq(tfZtnaApps.ownerUserId, userId);
}

ztnaAppRoutes.get('/apps', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const rows = await db
    .select()
    .from(tfZtnaApps)
    .where(and(ownerCondition(orgId, userId), ne(tfZtnaApps.status, 'deleted')));

  return c.json({ data: rows });
});

ztnaAppRoutes.post('/apps', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  // Hostname is globally unique (UNIQUE INDEX). Reject before insert for
  // a clearer error than the constraint violation.
  const [existing] = await db
    .select({ id: tfZtnaApps.id })
    .from(tfZtnaApps)
    .where(eq(tfZtnaApps.hostname, parsed.data.hostname))
    .limit(1);
  if (existing) {
    return c.json({ error: 'hostname_taken', message: 'Hostname is already gated' }, 409);
  }

  const id = generateId();
  const now = new Date().toISOString();
  await db.insert(tfZtnaApps).values({
    id,
    ownerUserId: userId,
    orgId,
    hostname: parsed.data.hostname,
    upstream: parsed.data.upstream,
    requiredTrustScore: parsed.data.requiredTrustScore,
    forwardWriteMethods: parsed.data.forwardWriteMethods,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ data: { id, ...parsed.data, status: 'active' } }, 201);
});

ztnaAppRoutes.patch('/apps/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const [row] = await db
    .select()
    .from(tfZtnaApps)
    .where(and(eq(tfZtnaApps.id, id), ownerCondition(orgId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);

  await db
    .update(tfZtnaApps)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(tfZtnaApps.id, id));

  return c.json({ data: { id, ...parsed.data } });
});

ztnaAppRoutes.delete('/apps/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const [row] = await db
    .select({ id: tfZtnaApps.id })
    .from(tfZtnaApps)
    .where(and(eq(tfZtnaApps.id, id), ownerCondition(orgId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);

  await db
    .update(tfZtnaApps)
    .set({ status: 'deleted', updatedAt: new Date().toISOString() })
    .where(eq(tfZtnaApps.id, id));

  return c.json({ data: { id, status: 'deleted' } });
});
