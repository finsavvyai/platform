/** Project members endpoints: list, change role, remove. */

import type { Env } from './types';
import {
  getAuthUser, checkProjectAccess, listProjectMembers,
  removeProjectMember, updateMemberRole, type ProjectRole,
} from './auth/rbac';

const VALID_ROLES = new Set<ProjectRole>(['owner', 'admin', 'member']);

/** GET /v1/projects/:id/members — any member may view the list. */
export async function handleListMembers(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkProjectAccess(env, user.sub, projectId))) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }
  const members = await listProjectMembers(env, projectId);
  return Response.json({ members });
}

/** PUT /v1/projects/:id/members/:userId — admin updates role. */
export async function handleUpdateRole(
  request: Request, env: Env, projectId: string, userId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkProjectAccess(env, user.sub, projectId, 'admin'))) {
    return Response.json({ error: 'Only admins can change roles' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { role?: string };
  const role = body.role as ProjectRole;
  if (!VALID_ROLES.has(role)) {
    return Response.json({ error: 'role must be owner, admin, or member' }, { status: 400 });
  }
  if (role === 'owner') {
    return Response.json({ error: 'Cannot change a member to owner via this endpoint' }, { status: 400 });
  }
  if (user.sub === userId) {
    return Response.json({ error: 'Cannot change your own role' }, { status: 400 });
  }
  await updateMemberRole(env, projectId, userId, role);
  return Response.json({ ok: true });
}

/** DELETE /v1/projects/:id/members/:userId — admin removes a member. */
export async function handleRemoveMember(
  request: Request, env: Env, projectId: string, userId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkProjectAccess(env, user.sub, projectId, 'admin'))) {
    return Response.json({ error: 'Only admins can remove members' }, { status: 403 });
  }
  if (user.sub === userId) {
    return Response.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }

  const owners = (await listProjectMembers(env, projectId)).filter((m) => m.role === 'owner');
  const target = owners.find((m) => m.user_id === userId);
  if (target && owners.length === 1) {
    return Response.json({ error: 'Cannot remove the last owner' }, { status: 400 });
  }

  await removeProjectMember(env, projectId, userId);
  return Response.json({ ok: true });
}

/** Dispatch /v1/projects/:id/members* routes. */
export async function routeMembers(
  request: Request, env: Env, path: string, method: string,
): Promise<Response | null> {
  const list = path.match(/^\/v1\/projects\/([^/]+)\/members$/);
  if (list && method === 'GET') return handleListMembers(request, env, list[1]);
  const scoped = path.match(/^\/v1\/projects\/([^/]+)\/members\/([^/]+)$/);
  if (scoped && method === 'PUT') return handleUpdateRole(request, env, scoped[1], scoped[2]);
  if (scoped && method === 'DELETE') return handleRemoveMember(request, env, scoped[1], scoped[2]);
  return null;
}
