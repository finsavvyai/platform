/** Webhook CRUD endpoints. */

import type { Env } from './types';
import { getAuthUser, checkProjectAccess } from './auth/rbac';
import { WEBHOOK_EVENTS } from './webhook-emit';

const VALID = new Set<string>(WEBHOOK_EVENTS);

function isValidUrl(url: string): boolean {
  try { const u = new URL(url); return u.protocol === 'https:'; } catch { return false; }
}

function normalizeEvents(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const items = raw.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
  if (!items.length) return null;
  if (items.includes('*')) return '*';
  if (!items.every((e) => VALID.has(e))) return null;
  return items.join(',');
}

/** POST /v1/projects/:id/webhooks — admin creates. Returns secret ONCE. */
export async function handleCreateWebhook(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkProjectAccess(env, user.sub, projectId, 'admin'))) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { url?: string; events?: string[] };
  if (!body.url || !isValidUrl(body.url)) {
    return Response.json({ error: 'Valid https URL required' }, { status: 400 });
  }
  const events = normalizeEvents(body.events);
  if (!events) {
    return Response.json({ error: `events must be non-empty array of: * or ${[...VALID].join(', ')}` }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const secret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  await env.DB.prepare(
    'INSERT INTO webhooks (id, project_id, url, events, secret) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, projectId, body.url, events, secret).run();

  return Response.json({ webhook: { id, url: body.url, events, secret } }, { status: 201 });
}

/** GET /v1/projects/:id/webhooks — list (any member). Secret not returned. */
export async function handleListWebhooks(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkProjectAccess(env, user.sub, projectId))) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }
  const rows = await env.DB.prepare(
    'SELECT id, url, events, created_at FROM webhooks WHERE project_id = ? ORDER BY created_at DESC',
  ).bind(projectId).all();
  return Response.json({ webhooks: rows.results ?? [] });
}

/** DELETE /v1/projects/:id/webhooks/:hookId — admin removes. */
export async function handleDeleteWebhook(
  request: Request, env: Env, projectId: string, hookId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkProjectAccess(env, user.sub, projectId, 'admin'))) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }
  await env.DB.prepare('DELETE FROM webhooks WHERE id = ? AND project_id = ?')
    .bind(hookId, projectId).run();
  return Response.json({ ok: true });
}

/** Dispatch /v1/projects/:id/webhooks* routes. */
export async function routeWebhooks(
  request: Request, env: Env, path: string, method: string,
): Promise<Response | null> {
  const base = path.match(/^\/v1\/projects\/([^/]+)\/webhooks$/);
  if (base && method === 'POST') return handleCreateWebhook(request, env, base[1]);
  if (base && method === 'GET') return handleListWebhooks(request, env, base[1]);
  const scoped = path.match(/^\/v1\/projects\/([^/]+)\/webhooks\/([^/]+)$/);
  if (scoped && method === 'DELETE') return handleDeleteWebhook(request, env, scoped[1], scoped[2]);
  return null;
}
