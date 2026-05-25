/**
 * DBSC revoke endpoint — POST /v1/dbsc/sessions/:id/revoke.
 *
 * Tenant-scoped soft-revoke. Sets revoked=1 and a reason; subsequent
 * refresh attempts respond with 401 session_revoked.
 *
 * GET /v1/dbsc/sessions lists active DBSC sessions for the tenant.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { tfDbscSessions } from '@opensyber/db';
import type { Env, Variables } from '../types.js';

const revokeSchema = z.object({ reason: z.string().min(1).max(120).optional() });

export const dbscSessionRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

dbscSessionRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const limitParam = parseInt(c.req.query('limit') ?? '20', 10);
  const limit = Math.min(Math.max(limitParam, 1), 100);
  const rows = await db
    .select()
    .from(tfDbscSessions)
    .where(eq(tfDbscSessions.tenantId, tenantId))
    .orderBy(desc(tfDbscSessions.createdAt))
    .limit(limit);
  return c.json({ data: rows });
});

dbscSessionRoutes.post('/:id/revoke', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const sessionId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = revokeSchema.safeParse(body);
  const reason = parsed.success ? (parsed.data.reason ?? 'admin_revoked') : 'admin_revoked';

  const [existing] = await db
    .select()
    .from(tfDbscSessions)
    .where(and(
      eq(tfDbscSessions.id, sessionId),
      eq(tfDbscSessions.tenantId, tenantId),
    ))
    .limit(1);
  if (!existing) return c.json({ error: 'session_not_found' }, 404);
  if (existing.revoked) {
    return c.json({ data: { revoked: true, id: sessionId, alreadyRevoked: true } });
  }

  const now = new Date().toISOString();
  await db
    .update(tfDbscSessions)
    .set({ revoked: true, revokedReason: reason, updatedAt: now })
    .where(and(
      eq(tfDbscSessions.id, sessionId),
      eq(tfDbscSessions.tenantId, tenantId),
    ));

  return c.json({ data: { revoked: true, id: sessionId, reason } });
});
