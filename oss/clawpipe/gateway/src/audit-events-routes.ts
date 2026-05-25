/** GET /v1/projects/:id/audit/events — Enterprise audit log retrieval. */

import type { Env } from './types';
import { getAuthUser, checkProjectAccess } from './auth/rbac';
import { readAuditEvents } from './audit-events';

/**
 * GET /v1/projects/:id/audit/events
 * Query params: since (ISO timestamp cursor), action (filter), limit (1-200)
 * RBAC: project admin or owner only.
 */
export async function handleGetAuditEvents(
  request: Request,
  env: Env,
  projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!isAdmin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const url = new URL(request.url);
  const since = url.searchParams.get('since') ?? undefined;
  const action = url.searchParams.get('action') ?? undefined;
  const limitParam = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;

  const events = await readAuditEvents(env, projectId, { since, action, limit });

  // Provide cursor for next page: created_at of last row.
  const nextCursor = events.length > 0 ? events[events.length - 1].created_at : null;

  return Response.json({ events, nextCursor });
}

/**
 * Route dispatcher for audit event endpoints.
 * Pattern: GET /v1/projects/:id/audit/events
 */
export async function routeAuditEvents(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  const match = path.match(/^\/v1\/projects\/([^/]+)\/audit\/events$/);
  if (match && method === 'GET') {
    return handleGetAuditEvents(request, env, match[1]);
  }
  return null;
}
