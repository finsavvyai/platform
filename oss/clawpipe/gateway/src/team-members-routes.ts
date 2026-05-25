/** Team membership endpoints: list, add by email, change role, remove. */

import type { Env } from './types';
import { getAuthUser } from './auth/rbac';
import { isValidEmail } from './email-digest';

type Role = 'owner' | 'admin' | 'member';
const VALID_ROLES = new Set<Role>(['owner', 'admin', 'member']);

async function hasAdminRole(env: Env, userId: string, teamId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND role IN ('owner', 'admin') LIMIT 1`,
  ).bind(teamId, userId).first();
  return Boolean(row);
}

async function isMember(env: Env, userId: string, teamId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1',
  ).bind(teamId, userId).first();
  return Boolean(row);
}

/** GET /v1/teams/:id/members — any team member may view. */
export async function handleListTeamMembers(
  request: Request, env: Env, teamId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isMember(env, user.sub, teamId))) {
    return Response.json({ error: 'Team not found' }, { status: 404 });
  }
  const rows = await env.DB.prepare(
    `SELECT u.id as user_id, u.email, u.name, tm.role
     FROM team_members tm JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ? ORDER BY tm.created_at`,
  ).bind(teamId).all();
  return Response.json({ members: rows.results ?? [] });
}

/** POST /v1/teams/:id/members — admin adds by email (user must already exist). */
export async function handleAddTeamMember(
  request: Request, env: Env, teamId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasAdminRole(env, user.sub, teamId))) {
    return Response.json({ error: 'Only team admins can add members' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { email?: string; role?: Role };
  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? 'member';
  if (!email || !isValidEmail(email)) return Response.json({ error: 'Valid email required' }, { status: 400 });
  if (role === 'owner') return Response.json({ error: 'Cannot add as owner' }, { status: 400 });
  if (!VALID_ROLES.has(role)) return Response.json({ error: 'Invalid role' }, { status: 400 });

  const target = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email).first<{ id: string }>();
  if (!target) {
    return Response.json({ error: 'User must already have a ClawPipe account' }, { status: 404 });
  }

  await env.DB.prepare(
    'INSERT OR IGNORE INTO team_members (id, team_id, user_id, role) VALUES (?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), teamId, target.id, role).run();

  return Response.json({ ok: true, userId: target.id, role });
}

/** PUT /v1/teams/:id/members/:userId — admin changes role (not to/from owner). */
export async function handleUpdateTeamRole(
  request: Request, env: Env, teamId: string, userId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasAdminRole(env, user.sub, teamId))) {
    return Response.json({ error: 'Only team admins can change roles' }, { status: 403 });
  }
  if (user.sub === userId) return Response.json({ error: 'Cannot change your own role' }, { status: 400 });

  const body = await request.json().catch(() => ({})) as { role?: Role };
  const role = body.role;
  if (!role || role === 'owner' || !VALID_ROLES.has(role)) {
    return Response.json({ error: 'role must be member or admin' }, { status: 400 });
  }

  const target = await env.DB.prepare(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?',
  ).bind(teamId, userId).first<{ role: Role }>();
  if (!target) return Response.json({ error: 'Member not found' }, { status: 404 });
  if (target.role === 'owner') return Response.json({ error: 'Cannot demote an owner' }, { status: 400 });

  await env.DB.prepare(
    'UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?',
  ).bind(role, teamId, userId).run();
  return Response.json({ ok: true });
}

/** DELETE /v1/teams/:id/members/:userId — admin removes, guard last owner. */
export async function handleRemoveTeamMember(
  request: Request, env: Env, teamId: string, userId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasAdminRole(env, user.sub, teamId))) {
    return Response.json({ error: 'Only team admins can remove' }, { status: 403 });
  }
  if (user.sub === userId) return Response.json({ error: 'Cannot remove yourself' }, { status: 400 });

  const owners = await env.DB.prepare(
    `SELECT user_id FROM team_members WHERE team_id = ? AND role = 'owner'`,
  ).bind(teamId).all<{ user_id: string }>();
  const ownerIds = (owners.results ?? []).map((o) => o.user_id);
  if (ownerIds.includes(userId) && ownerIds.length === 1) {
    return Response.json({ error: 'Cannot remove the last owner' }, { status: 400 });
  }

  await env.DB.prepare(
    'DELETE FROM team_members WHERE team_id = ? AND user_id = ?',
  ).bind(teamId, userId).run();
  return Response.json({ ok: true });
}

/** Dispatch /v1/teams/:id/members* routes. */
export async function routeTeamMembers(
  request: Request, env: Env, path: string, method: string,
): Promise<Response | null> {
  const list = path.match(/^\/v1\/teams\/([^/]+)\/members$/);
  if (list && method === 'GET') return handleListTeamMembers(request, env, list[1]);
  if (list && method === 'POST') return handleAddTeamMember(request, env, list[1]);
  const scoped = path.match(/^\/v1\/teams\/([^/]+)\/members\/([^/]+)$/);
  if (scoped && method === 'PUT') return handleUpdateTeamRole(request, env, scoped[1], scoped[2]);
  if (scoped && method === 'DELETE') return handleRemoveTeamMember(request, env, scoped[1], scoped[2]);
  return null;
}
