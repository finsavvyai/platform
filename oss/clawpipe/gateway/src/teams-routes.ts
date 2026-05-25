/** Team endpoints — create team, set team budget, link project to team. */

import type { Env } from './types';
import { getAuthUser, checkProjectAccess } from './auth/rbac';
import { getTeamBudgetStatus, getTeamRateLimit } from './budget';

interface TeamRow { id: string; name: string; budget_usd: number | null }

/** Is the user owner or admin of this team? */
async function hasTeamRole(env: Env, userId: string, teamId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 FROM team_members
     WHERE team_id = ? AND user_id = ? AND role IN ('owner', 'admin') LIMIT 1`,
  ).bind(teamId, userId).first();
  return Boolean(row);
}

/** POST /v1/teams — create team; caller becomes owner. */
export async function handleCreateTeam(request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { name?: string };
  const name = body.name?.trim();
  if (!name) return Response.json({ error: 'name required' }, { status: 400 });

  const teamId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO teams (id, name) VALUES (?, ?)').bind(teamId, name),
    env.DB.prepare(
      "INSERT INTO team_members (id, team_id, user_id, role) VALUES (?, ?, ?, 'owner')",
    ).bind(crypto.randomUUID(), teamId, user.sub),
  ]);
  // Audit: team.created — no projectId here; use teamId as target, skip projectId write.
  // NOTE: audit_events requires project_id FK; team-create has no project scope.
  // Follow-up: add a team_audit_events table or relax FK. Hook deferred for now.
  return Response.json({ team: { id: teamId, name, budget_usd: null } }, { status: 201 });
}

/** GET /v1/teams — list teams the user is a member of. */
export async function handleListTeams(request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await env.DB.prepare(
    `SELECT t.id, t.name, t.budget_usd, tm.role
     FROM team_members tm JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = ? ORDER BY t.created_at DESC`,
  ).bind(user.sub).all<TeamRow & { role: string }>();

  return Response.json({ teams: rows.results ?? [] });
}

/** PUT /v1/teams/:id/budget — set or clear monthly team cap. */
export async function handleSetTeamBudget(
  request: Request, env: Env, teamId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasTeamRole(env, user.sub, teamId))) {
    return Response.json({ error: 'Only team admins can set budgets' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { monthlyCap?: number | null };
  const cap = body.monthlyCap;
  if (cap != null && (typeof cap !== 'number' || !isFinite(cap) || cap < 0)) {
    return Response.json({ error: 'monthlyCap must be non-negative or null' }, { status: 400 });
  }
  const val = cap == null || cap === 0 ? null : cap;
  await env.DB.prepare('UPDATE teams SET budget_usd = ? WHERE id = ?').bind(val, teamId).run();

  const status = await getTeamBudgetStatus(env, teamId);
  return Response.json({ ok: true, budget: status });
}

/** PUT /v1/teams/:id/rate-limit — set or clear per-day team request cap. */
export async function handleSetTeamRateLimit(
  request: Request, env: Env, teamId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasTeamRole(env, user.sub, teamId))) {
    return Response.json({ error: 'Only team admins can set rate limits' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({})) as { perDay?: number | null };
  const cap = body.perDay;
  if (cap != null && (typeof cap !== 'number' || !isFinite(cap) || cap < 0 || !Number.isInteger(cap))) {
    return Response.json({ error: 'perDay must be a non-negative integer or null' }, { status: 400 });
  }
  const val = cap == null || cap === 0 ? null : cap;
  await env.DB.prepare('UPDATE teams SET rate_limit_per_day = ? WHERE id = ?').bind(val, teamId).run();
  const rate = await getTeamRateLimit(env, teamId);
  return Response.json({ ok: true, rate });
}

/** GET /v1/teams/:id — team budget status (sum across member projects). */
export async function handleGetTeam(
  request: Request, env: Env, teamId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const member = await env.DB.prepare(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1',
  ).bind(teamId, user.sub).first<{ role: string }>();
  if (!member) return Response.json({ error: 'Team not found' }, { status: 404 });

  const team = await env.DB.prepare('SELECT id, name FROM teams WHERE id = ?')
    .bind(teamId).first<{ id: string; name: string }>();
  const budget = await getTeamBudgetStatus(env, teamId);
  const rate = await getTeamRateLimit(env, teamId);
  return Response.json({ team, role: member.role, budget, rate });
}

/** PUT /v1/projects/:id/team — link or unlink project to team. */
export async function handleLinkProjectTeam(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const projectAccess = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!projectAccess) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { teamId?: string | null };
  const teamId = body.teamId?.trim() || null;

  if (teamId && !(await hasTeamRole(env, user.sub, teamId))) {
    return Response.json({ error: 'You are not admin of that team' }, { status: 403 });
  }

  await env.DB.prepare('UPDATE projects SET team_id = ? WHERE id = ?').bind(teamId, projectId).run();
  return Response.json({ ok: true, teamId });
}

/** Dispatch team-related routes. Returns null if not matched. */
export async function routeTeams(
  request: Request, env: Env, path: string, method: string,
): Promise<Response | null> {
  if (path === '/v1/teams' && method === 'POST') return handleCreateTeam(request, env);
  if (path === '/v1/teams' && method === 'GET') return handleListTeams(request, env);
  const teamBudget = path.match(/^\/v1\/teams\/([^/]+)\/budget$/);
  if (teamBudget && method === 'PUT') return handleSetTeamBudget(request, env, teamBudget[1]);
  const teamRate = path.match(/^\/v1\/teams\/([^/]+)\/rate-limit$/);
  if (teamRate && method === 'PUT') return handleSetTeamRateLimit(request, env, teamRate[1]);
  const teamGet = path.match(/^\/v1\/teams\/([^/]+)$/);
  if (teamGet && method === 'GET') return handleGetTeam(request, env, teamGet[1]);
  const link = path.match(/^\/v1\/projects\/([^/]+)\/team$/);
  if (link && method === 'PUT') return handleLinkProjectTeam(request, env, link[1]);
  return null;
}
