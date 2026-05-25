/** Slack webhook endpoints — set/clear webhook URL, send test digest. */

import type { Env } from './types';
import { getAuthUser, checkProjectAccess } from './auth/rbac';
import {
  collectProjectDigest, formatSlackBlocks, postToSlack,
  isValidSlackWebhook, runDigestForAllProjects,
} from './slack-digest';

/** PUT /v1/projects/:id/slack-webhook — set or clear webhook URL. */
export async function handleSetSlackWebhook(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const hasAccess = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!hasAccess) return Response.json({ error: 'Only admins can manage Slack digests' }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { url?: string | null };
  const url = body.url?.trim() || null;

  if (url && !isValidSlackWebhook(url)) {
    return Response.json(
      { error: 'Invalid Slack webhook URL. Must start with https://hooks.slack.com/services/' },
      { status: 400 },
    );
  }

  await env.DB.prepare('UPDATE projects SET slack_webhook_url = ? WHERE id = ?')
    .bind(url, projectId).run();

  return Response.json({ ok: true, configured: Boolean(url) });
}

/** POST /v1/projects/:id/slack-digest/test — send a real digest now. */
export async function handleSendTestDigest(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const hasAccess = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!hasAccess) return Response.json({ error: 'Only admins can trigger digests' }, { status: 403 });

  const project = await env.DB.prepare(
    'SELECT name, slack_webhook_url FROM projects WHERE id = ?',
  ).bind(projectId).first<{ name: string; slack_webhook_url: string | null }>();

  if (!project?.slack_webhook_url) {
    return Response.json({ error: 'No Slack webhook configured for this project' }, { status: 400 });
  }

  const stats = await collectProjectDigest(env, projectId, project.name);
  const sent = await postToSlack(project.slack_webhook_url, formatSlackBlocks(stats));
  return Response.json({ ok: sent, stats });
}

/** Dispatch /v1/projects/:id/slack-* routes. Returns null if not matched. */
export async function routeSlack(
  request: Request, env: Env, path: string, method: string,
): Promise<Response | null> {
  const webhookMatch = path.match(/^\/v1\/projects\/([^/]+)\/slack-webhook$/);
  if (webhookMatch && method === 'PUT') {
    return handleSetSlackWebhook(request, env, webhookMatch[1]);
  }
  const testMatch = path.match(/^\/v1\/projects\/([^/]+)\/slack-digest\/test$/);
  if (testMatch && method === 'POST') {
    return handleSendTestDigest(request, env, testMatch[1]);
  }
  return null;
}

export { runDigestForAllProjects };
