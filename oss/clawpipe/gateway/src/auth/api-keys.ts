/** API Key management — create, list, rotate, revoke project API keys. */

import type { Env } from '../types';
import { getAuthUser } from './rbac';
import { checkProjectAccess } from './rbac';
import { writeAuditEvent } from '../audit-events';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
}

/** POST /v1/projects/:id/keys — create a new API key for a project. */
export async function handleCreateKey(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const hasAccess = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!hasAccess) return Response.json({ error: 'Insufficient permissions' }, { status: 403 });

  let body: { name?: string };
  try { body = await request.json() as typeof body; } catch { body = {}; }

  const rawKey = `cp_${generateKey(32)}`;
  const keyHash = await hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 7) + '...' + rawKey.slice(-4);
  const keyName = body.name ?? 'Default';

  await env.DB.prepare(
    `UPDATE projects SET api_key_hash = ? WHERE id = ?`,
  ).bind(keyHash, projectId).run();

  return Response.json({
    key: rawKey,
    prefix: keyPrefix,
    name: keyName,
    warning: 'Store this key securely. It will not be shown again.',
  }, { status: 201 });
}

/** GET /v1/projects/:id/keys — list API keys (prefixes only). */
export async function handleListKeys(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const hasAccess = await checkProjectAccess(env, user.sub, projectId);
  if (!hasAccess) return Response.json({ error: 'Insufficient permissions' }, { status: 403 });

  const project = await env.DB.prepare(
    'SELECT id, name, api_key_hash, tier, created_at FROM projects WHERE id = ?',
  ).bind(projectId).first();

  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

  return Response.json({
    project: { id: project.id, name: project.name, tier: project.tier },
    hasKey: !!(project as Record<string, unknown>).api_key_hash,
  });
}

/** POST /v1/projects/:id/keys/rotate — rotate the API key. */
export async function handleRotateKey(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const hasAccess = await checkProjectAccess(env, user.sub, projectId, 'owner');
  if (!hasAccess) return Response.json({ error: 'Only owners can rotate keys' }, { status: 403 });

  const rawKey = `cp_${generateKey(32)}`;
  const keyHash = await hashKey(rawKey);

  await env.DB.prepare('UPDATE projects SET api_key_hash = ? WHERE id = ?')
    .bind(keyHash, projectId).run();
  writeAuditEvent(env, {
    projectId, actorUserId: user.sub, action: 'apikey.rotate',
  }).catch(() => {});

  return Response.json({
    key: rawKey,
    prefix: rawKey.slice(0, 7) + '...' + rawKey.slice(-4),
    warning: 'Previous key is now invalid. Update your applications.',
  });
}

/** DELETE /v1/projects/:id/keys — revoke the API key. */
export async function handleRevokeKey(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const hasAccess = await checkProjectAccess(env, user.sub, projectId, 'owner');
  if (!hasAccess) return Response.json({ error: 'Only owners can revoke keys' }, { status: 403 });

  await env.DB.prepare("UPDATE projects SET api_key_hash = '' WHERE id = ?")
    .bind(projectId).run();

  return Response.json({ ok: true, message: 'API key revoked' });
}

/** POST /v1/projects — create a new project (authenticated). */
export async function handleCreateProject(request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { name: string };
  try { body = await request.json() as typeof body; } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.name) return Response.json({ error: 'Project name required' }, { status: 400 });

  const id = crypto.randomUUID();
  const rawKey = `cp_${generateKey(32)}`;
  const keyHash = await hashKey(rawKey);

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO projects (id, name, api_key_hash, tier) VALUES (?, ?, ?, 'free')",
    ).bind(id, body.name, keyHash),
    env.DB.prepare(
      "INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, 'owner')",
    ).bind(crypto.randomUUID(), id, user.sub),
  ]);

  return Response.json({ project: { id, name: body.name, tier: 'free' }, apiKey: rawKey }, { status: 201 });
}

/** GET /v1/projects — list projects the user has access to. */
export async function handleListProjects(request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const rows = await env.DB.prepare(`
    SELECT p.id, p.name, p.tier, p.created_at, pm.role
    FROM projects p JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = ? ORDER BY p.created_at DESC
  `).bind(user.sub).all<{ id: string; name: string; tier: string; created_at: string; role: string }>();

  return Response.json({ projects: rows.results ?? [] });
}

function generateKey(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
