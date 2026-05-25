/**
 * Admin endpoints — server-to-server (App API key).
 *
 *   POST /v1/sessions/:id/revoke   force-revoke a session
 *   GET  /v1/sessions?subject=...  list active sessions for a subject
 */

import type { Context } from 'hono';
import { z } from 'zod';
import type { DbAccess } from '../lib/db-access.js';
import { newAuditId } from '../lib/ids.js';
import type { App } from '@tokenforge/db';

const revokeSchema = z.object({ reason: z.string().min(1).max(200).optional() });

export async function handleRevoke(
  c: Context,
  deps: { db: DbAccess },
): Promise<Response> {
  const sessionId = c.req.param('id');
  if (!sessionId) return c.json({ error: 'missing_session_id' }, 400);
  const app = c.get('app') as App;
  const session = await deps.db.findSession(sessionId);
  if (!session) return c.json({ error: 'session_unknown' }, 404);
  if (session.appId !== app.id) return c.json({ error: 'session_app_mismatch' }, 403);
  if (session.revokedAt) return c.json({ error: 'already_revoked' }, 409);

  const body = await safeJson(c);
  const parsed = revokeSchema.safeParse(body ?? {});
  const reason = parsed.success && parsed.data.reason ? parsed.data.reason : 'admin_revoke';

  const now = new Date();
  await deps.db.revokeSession(sessionId, reason, now);
  await deps.db.insertAudit({
    id: newAuditId(),
    appId: app.id,
    sessionId,
    type: 'revoke',
    severity: 'warn',
    payload: { reason },
    at: now,
  });
  return c.json({ ok: true, revoked_at: now.toISOString(), reason });
}

export async function handleList(
  c: Context,
  deps: { db: DbAccess },
): Promise<Response> {
  const subjectExternal = c.req.query('subject');
  if (!subjectExternal) return c.json({ error: 'missing_subject' }, 400);
  const app = c.get('app') as App;
  const subj = await deps.db.findSubject(app.id, subjectExternal);
  if (!subj) return c.json({ sessions: [] });
  const list = await deps.db.listActiveSessions(app.id, subj.id);
  return c.json({
    sessions: list.map((s) => ({
      session_id: s.id,
      binding_class: s.bindingClass,
      origin: s.origin,
      created_at: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      last_refresh_at:
        s.lastRefreshAt instanceof Date ? s.lastRefreshAt.toISOString() : s.lastRefreshAt,
      expires_at: s.expiresAt instanceof Date ? s.expiresAt.toISOString() : s.expiresAt,
    })),
  });
}

async function safeJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
