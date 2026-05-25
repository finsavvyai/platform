/** Project invitation endpoints + email formatter. */

import type { Env } from './types';
import { getAuthUser, checkProjectAccess } from './auth/rbac';
import { writeAuditEvent } from './audit-events';
import { isValidEmail, sendEmail } from './email-digest';

const INVITE_BASE = 'https://app.clawpipe.ai/invite';
const VALID_ROLES = new Set(['member', 'admin']);

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** HTML + text body for invite email. */
export function formatInviteEmail(projectName: string, inviterName: string, token: string): {
  subject: string; html: string; text: string;
} {
  const link = `${INVITE_BASE}/${token}`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fafafa;color:#1d1d1f;padding:24px">
  <table style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e5e7;border-radius:14px;padding:28px" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:18px;font-weight:700">You've been invited to ${esc(projectName)}</td></tr>
    <tr><td style="font-size:14px;color:#515154;padding:12px 0 20px">${esc(inviterName)} added you to their ClawPipe project. Accept to see AI spend, set budgets, and manage requests.</td></tr>
    <tr><td><a href="${link}" style="display:inline-block;background:#6e56cf;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Accept invite</a></td></tr>
    <tr><td style="font-size:12px;color:#6e6e73;padding-top:20px">Or paste this URL: ${link}</td></tr>
  </table></body></html>`;
  const text = `You've been invited to ${projectName}\n${inviterName} added you to their ClawPipe project.\nAccept: ${link}`;
  return { subject: `Invitation to ${projectName} on ClawPipe`, html, text };
}

/** POST /v1/projects/:id/invitations — admin sends invite email. */
export async function handleCreateInvitation(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkProjectAccess(env, user.sub, projectId, 'admin'))) {
    return Response.json({ error: 'Only admins can invite' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? 'member';
  if (!email || !isValidEmail(email)) return Response.json({ error: 'Valid email required' }, { status: 400 });
  if (!VALID_ROLES.has(role)) return Response.json({ error: 'role must be member or admin' }, { status: 400 });

  const project = await env.DB.prepare('SELECT name FROM projects WHERE id = ?')
    .bind(projectId).first<{ name: string }>();
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

  const id = crypto.randomUUID();
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  await env.DB.prepare(
    'INSERT INTO project_invitations (id, project_id, email, role, token, invited_by) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(id, projectId, email, role, token, user.sub).run();

  sendEmail(env, email, formatInviteEmail(project.name, user.name || user.email, token)).catch(() => {});

  return Response.json({ invitation: { id, email, role, token } }, { status: 201 });
}

/** GET /v1/invitations/:token — preview (no auth). */
export async function handleGetInvitation(
  _request: Request, env: Env, token: string,
): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT i.email, i.role, i.accepted_at, i.revoked_at, p.name as project_name
     FROM project_invitations i JOIN projects p ON p.id = i.project_id
     WHERE i.token = ?`,
  ).bind(token).first<{ email: string; role: string; accepted_at: string | null; revoked_at: string | null; project_name: string }>();
  if (!row) return Response.json({ error: 'Invitation not found' }, { status: 404 });
  if (row.revoked_at) return Response.json({ error: 'Invitation revoked' }, { status: 410 });
  if (row.accepted_at) return Response.json({ error: 'Invitation already accepted' }, { status: 410 });
  return Response.json({ email: row.email, role: row.role, projectName: row.project_name });
}

/** POST /v1/invitations/:token/accept — logged-in user joins as project_member. */
export async function handleAcceptInvitation(
  request: Request, env: Env, token: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await env.DB.prepare(
    'SELECT id, project_id, email, role, accepted_at, revoked_at FROM project_invitations WHERE token = ?',
  ).bind(token).first<{ id: string; project_id: string; email: string; role: string; accepted_at: string | null; revoked_at: string | null }>();
  if (!row) return Response.json({ error: 'Invitation not found' }, { status: 404 });
  if (row.revoked_at) return Response.json({ error: 'Invitation revoked' }, { status: 410 });
  if (row.accepted_at) return Response.json({ error: 'Already accepted' }, { status: 410 });
  if (user.email.toLowerCase() !== row.email.toLowerCase()) {
    return Response.json({ error: 'This invite was sent to a different email' }, { status: 403 });
  }

  await env.DB.batch([
    env.DB.prepare(
      'INSERT OR IGNORE INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), row.project_id, user.sub, row.role),
    env.DB.prepare("UPDATE project_invitations SET accepted_at = datetime('now') WHERE id = ?").bind(row.id),
  ]);
  writeAuditEvent(env, {
    projectId: row.project_id, actorUserId: user.sub,
    action: 'member.joined', target: user.email, metadata: { role: row.role },
  }).catch(() => {});

  return Response.json({ ok: true, projectId: row.project_id, role: row.role });
}

/** GET /v1/projects/:id/invitations — admin lists pending. */
export async function handleListInvitations(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkProjectAccess(env, user.sub, projectId, 'admin'))) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }
  const rows = await env.DB.prepare(
    `SELECT id, email, role, created_at, accepted_at, revoked_at
     FROM project_invitations WHERE project_id = ? ORDER BY created_at DESC`,
  ).bind(projectId).all();
  return Response.json({ invitations: rows.results ?? [] });
}

/** DELETE /v1/projects/:id/invitations/:invId — admin revokes pending. */
export async function handleRevokeInvitation(
  request: Request, env: Env, projectId: string, invId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkProjectAccess(env, user.sub, projectId, 'admin'))) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }
  await env.DB.prepare(
    "UPDATE project_invitations SET revoked_at = datetime('now') WHERE id = ? AND project_id = ? AND accepted_at IS NULL",
  ).bind(invId, projectId).run();
  return Response.json({ ok: true });
}

/** Dispatch invitation routes. Returns null if not matched. */
export async function routeInvitations(
  request: Request, env: Env, path: string, method: string,
): Promise<Response | null> {
  const create = path.match(/^\/v1\/projects\/([^/]+)\/invitations$/);
  if (create && method === 'POST') return handleCreateInvitation(request, env, create[1]);
  if (create && method === 'GET') return handleListInvitations(request, env, create[1]);

  const revoke = path.match(/^\/v1\/projects\/([^/]+)\/invitations\/([^/]+)$/);
  if (revoke && method === 'DELETE') return handleRevokeInvitation(request, env, revoke[1], revoke[2]);

  const get = path.match(/^\/v1\/invitations\/([^/]+)$/);
  if (get && method === 'GET') return handleGetInvitation(request, env, get[1]);

  const accept = path.match(/^\/v1\/invitations\/([^/]+)\/accept$/);
  if (accept && method === 'POST') return handleAcceptInvitation(request, env, accept[1]);

  return null;
}
