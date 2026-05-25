/** Project settings endpoints: GET combined settings, PUT monthly budget, Teams webhook. */

import type { Env } from './types';
import { getAuthUser, checkProjectAccess } from './auth/rbac';
import { writeAuditEvent } from './audit-events';
import { getBudgetStatus, getTeamBudgetStatus } from './budget';
import { isValidEmail, formatDigestEmail, sendEmail } from './email-digest';
import { collectProjectDigest } from './slack-digest';
import { isValidTeamsWebhook, formatDigestCard, postToTeams } from './teams-digest';

/** GET /v1/projects/:id/settings — admin-only, returns slack + teams + budget status. */
export async function handleGetSettings(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkProjectAccess(env, user.sub, projectId);
  if (!access) return Response.json({ error: 'Project not found' }, { status: 404 });

  const row = await env.DB.prepare(
    'SELECT name, slack_webhook_url, digest_email, teams_webhook_url, team_id FROM projects WHERE id = ?',
  ).bind(projectId).first<{ name: string; slack_webhook_url: string | null; digest_email: string | null; teams_webhook_url: string | null; team_id: string | null }>();

  if (!row) return Response.json({ error: 'Project not found' }, { status: 404 });

  const budget = await getBudgetStatus(env, projectId);
  const team = row.team_id ? await getTeamBudgetStatus(env, row.team_id) : null;

  return Response.json({
    projectName: row.name,
    slack: { configured: Boolean(row.slack_webhook_url) },
    email: { configured: Boolean(row.digest_email), address: row.digest_email },
    teams: { configured: Boolean(row.teams_webhook_url) },
    budget,
    team: row.team_id ? { id: row.team_id, budget: team } : null,
  });
}

/** PUT /v1/projects/:id/digest-email — set or clear recipient. */
export async function handleSetDigestEmail(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!access) return Response.json({ error: 'Only admins can manage email digests' }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { email?: string | null };
  const email = body.email?.trim() || null;

  if (email && !isValidEmail(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }

  await env.DB.prepare('UPDATE projects SET digest_email = ? WHERE id = ?')
    .bind(email, projectId).run();

  return Response.json({ ok: true, configured: Boolean(email) });
}

/** PUT /v1/projects/:id/budget — admin-only, set or clear monthly cap. */
export async function handleSetBudget(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!access) return Response.json({ error: 'Only admins can set budgets' }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { monthlyCap?: number | null };
  const cap = body.monthlyCap;

  if (cap != null && (typeof cap !== 'number' || !isFinite(cap) || cap < 0)) {
    return Response.json({ error: 'monthlyCap must be a non-negative number or null' }, { status: 400 });
  }

  const prev = await env.DB.prepare('SELECT monthly_budget_usd FROM projects WHERE id = ?')
    .bind(projectId).first<{ monthly_budget_usd: number | null }>();
  const val = cap == null || cap === 0 ? null : cap;
  await env.DB.prepare('UPDATE projects SET monthly_budget_usd = ? WHERE id = ?')
    .bind(val, projectId).run();
  writeAuditEvent(env, {
    projectId, actorUserId: user.sub, action: 'budget.cap.changed',
    metadata: { from: prev?.monthly_budget_usd ?? null, to: val },
  }).catch(() => {});

  const budget = await getBudgetStatus(env, projectId);
  return Response.json({ ok: true, budget });
}

/** POST /v1/projects/:id/digest-email/test — send a real digest email now. */
export async function handleSendTestEmail(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!access) return Response.json({ error: 'Only admins can trigger digests' }, { status: 403 });

  const project = await env.DB.prepare(
    'SELECT name, digest_email FROM projects WHERE id = ?',
  ).bind(projectId).first<{ name: string; digest_email: string | null }>();
  if (!project?.digest_email) {
    return Response.json({ error: 'No digest email configured for this project' }, { status: 400 });
  }
  if (!env.RESEND_API_KEY) {
    return Response.json({ error: 'Email delivery not configured on the gateway' }, { status: 503 });
  }

  const stats = await collectProjectDigest(env, projectId, project.name);
  const ok = await sendEmail(env, project.digest_email, formatDigestEmail(stats));
  return Response.json({ ok, to: project.digest_email });
}

/** PUT /v1/projects/:id/teams-webhook — set or clear Teams webhook URL. */
export async function handleSetTeamsWebhook(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!access) return Response.json({ error: 'Only admins can manage Teams digests' }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { url?: string | null };
  const url = body.url?.trim() || null;
  if (url && !isValidTeamsWebhook(url)) {
    return Response.json({ error: 'Invalid Teams webhook URL. Must be https://*.webhook.office.com or *.webhook.office.us' }, { status: 400 });
  }
  await env.DB.prepare('UPDATE projects SET teams_webhook_url = ? WHERE id = ?').bind(url, projectId).run();
  return Response.json({ ok: true, configured: Boolean(url) });
}

/** POST /v1/projects/:id/teams-digest/test — send a real Teams digest now. */
export async function handleSendTestTeamsDigest(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!access) return Response.json({ error: 'Only admins can trigger digests' }, { status: 403 });
  const project = await env.DB.prepare('SELECT name, teams_webhook_url FROM projects WHERE id = ?')
    .bind(projectId).first<{ name: string; teams_webhook_url: string | null }>();
  if (!project?.teams_webhook_url) {
    return Response.json({ error: 'No Teams webhook configured for this project' }, { status: 400 });
  }
  const stats = await collectProjectDigest(env, projectId, project.name);
  const sent = await postToTeams(project.teams_webhook_url, formatDigestCard(stats));
  return Response.json({ ok: sent });
}

/** Dispatch /v1/projects/:id/settings, /budget, /digest-email, /teams-webhook routes. */
export async function routeSettings(
  request: Request, env: Env, path: string, method: string,
): Promise<Response | null> {
  const settingsMatch = path.match(/^\/v1\/projects\/([^/]+)\/settings$/);
  if (settingsMatch && method === 'GET') return handleGetSettings(request, env, settingsMatch[1]);
  const budgetMatch = path.match(/^\/v1\/projects\/([^/]+)\/budget$/);
  if (budgetMatch && method === 'PUT') return handleSetBudget(request, env, budgetMatch[1]);
  const emailMatch = path.match(/^\/v1\/projects\/([^/]+)\/digest-email$/);
  if (emailMatch && method === 'PUT') return handleSetDigestEmail(request, env, emailMatch[1]);
  const emailTestMatch = path.match(/^\/v1\/projects\/([^/]+)\/digest-email\/test$/);
  if (emailTestMatch && method === 'POST') return handleSendTestEmail(request, env, emailTestMatch[1]);
  const teamsMatch = path.match(/^\/v1\/projects\/([^/]+)\/teams-webhook$/);
  if (teamsMatch && method === 'PUT') return handleSetTeamsWebhook(request, env, teamsMatch[1]);
  const teamsTestMatch = path.match(/^\/v1\/projects\/([^/]+)\/teams-digest\/test$/);
  if (teamsTestMatch && method === 'POST') return handleSendTestTeamsDigest(request, env, teamsTestMatch[1]);
  return null;
}
