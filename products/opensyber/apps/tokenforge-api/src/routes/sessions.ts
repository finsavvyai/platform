import { Hono } from 'hono';
import { eq, and, desc, gt } from 'drizzle-orm';
import { deviceSessions } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { dispatchWebhook } from '../services/webhook-dispatch.js';

export const sessionRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/** GET /v1/sessions — list device sessions for tenant (cursor pagination) */
sessionRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const cursor = c.req.query('cursor');
  const limitParam = parseInt(c.req.query('limit') ?? '20', 10);
  const limit = Math.min(Math.max(limitParam, 1), 100);

  const query = db
    .select()
    .from(deviceSessions)
    .where(
      cursor
        ? and(
            eq(deviceSessions.tenantId, tenantId),
            gt(deviceSessions.id, cursor),
          )
        : eq(deviceSessions.tenantId, tenantId),
    )
    .orderBy(desc(deviceSessions.createdAt))
    .limit(limit + 1);

  const rows = await query;
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.id : null;

  return c.json({ data, nextCursor, hasMore });
});

/** GET /v1/sessions/:id — get single session */
sessionRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const sessionId = c.req.param('id');

  const rows = await db
    .select()
    .from(deviceSessions)
    .where(
      and(
        eq(deviceSessions.id, sessionId),
        eq(deviceSessions.tenantId, tenantId),
      ),
    );

  if (rows.length === 0) {
    return c.json({ error: 'not_found', message: 'Session not found' }, 404);
  }

  return c.json({ data: rows[0] });
});

/** DELETE /v1/sessions/:id — revoke session */
sessionRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const sessionId = c.req.param('id');

  const rows = await db
    .select()
    .from(deviceSessions)
    .where(
      and(
        eq(deviceSessions.id, sessionId),
        eq(deviceSessions.tenantId, tenantId),
      ),
    );

  if (rows.length === 0) {
    return c.json({ error: 'not_found', message: 'Session not found' }, 404);
  }

  await db
    .update(deviceSessions)
    .set({ revoked: 1, revokedReason: 'api_revoked' })
    .where(
      and(
        eq(deviceSessions.id, sessionId),
        eq(deviceSessions.tenantId, tenantId),
      ),
    );

  const revokedSession = rows[0]!;
  c.executionCtx.waitUntil(
    dispatchWebhook(db, tenantId, 'session.revoked', {
      deviceId: revokedSession.id,
      sessionId: revokedSession.sessionId,
      userId: revokedSession.userId,
      reason: 'api_revoked',
    }),
  );

  return c.json({ data: { revoked: true, id: sessionId } });
});
