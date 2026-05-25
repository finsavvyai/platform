/**
 * JIT Access Request Routes
 *
 * Endpoints for requesting, approving, and denying temporary secret access.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { jitAccessRequests } from '@opensyber/db';
import {
  createJitRequest, approveJitRequest, denyJitRequest, expireOverdueRequests,
} from '../services/jit-access-manager.js';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { createJitRequestSchema } from './validation/jit-access.js';

export const jitAccessRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

jitAccessRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

jitAccessRoutes.get('/jit-requests', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const requests = await db.select().from(jitAccessRequests)
    .where(eq(jitAccessRequests.orgId, orgId));
  return c.json({ data: requests });
});

jitAccessRoutes.post('/jit-requests', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const userId = c.get('userId');
  const db = c.get('db');
  const parsed = createJitRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const id = crypto.randomUUID();
  await createJitRequest(db, {
    id, orgId, requesterId: userId,
    secretId: parsed.data.secretId, reason: parsed.data.reason,
    durationMinutes: parsed.data.durationMinutes,
  });
  return c.json({ data: { id } }, 201);
});

jitAccessRoutes.patch('/jit-requests/:id/approve', requirePermission('vault.write'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const userId = c.get('userId');
  const db = c.get('db');
  const ok = await approveJitRequest(db, orgId, c.req.param('id'), userId);
  if (!ok) return c.json({ error: 'Request not found or not pending' }, 404);
  return c.json({ data: { approved: true } });
});

jitAccessRoutes.patch('/jit-requests/:id/deny', requirePermission('vault.write'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const ok = await denyJitRequest(db, orgId, c.req.param('id'));
  if (!ok) return c.json({ error: 'Request not found or not pending' }, 404);
  return c.json({ data: { denied: true } });
});

jitAccessRoutes.post('/jit-requests/expire', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const expired = await expireOverdueRequests(db, orgId);
  return c.json({ data: { expired } });
});
