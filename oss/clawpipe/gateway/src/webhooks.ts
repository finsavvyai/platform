/** Webhooks — subscribe to ClawPipe events and deliver to external URLs. */

import type { Env } from './types';

export type WebhookEvent =
  | 'budget_threshold'
  | 'rate_limit_hit'
  | 'provider_down'
  | 'cost_spike';

const VALID_EVENTS: WebhookEvent[] = [
  'budget_threshold', 'rate_limit_hit', 'provider_down', 'cost_spike',
];

interface WebhookRow {
  id: string;
  project_id: string;
  url: string;
  events: string;
  threshold: number | null;
  created_at: string;
}

interface CreateBody {
  url?: string;
  events?: string[];
  threshold?: number;
}

function isValidUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch { return false; }
}

function toPayload(r: WebhookRow) {
  return {
    id: r.id,
    url: r.url,
    events: JSON.parse(r.events) as WebhookEvent[],
    threshold: r.threshold,
    createdAt: r.created_at,
  };
}

/** POST /v1/webhooks — create a webhook subscription. */
export async function handleWebhookCreate(
  request: Request, env: Env, projectId: string,
): Promise<Response> {
  let body: CreateBody;
  try { body = await request.json() as CreateBody; }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  if (!body.url || !isValidUrl(body.url)) {
    return Response.json({ error: 'Invalid or missing url' }, { status: 400 });
  }
  const events = (body.events ?? []).filter((e): e is WebhookEvent =>
    VALID_EVENTS.includes(e as WebhookEvent));
  if (events.length === 0) {
    return Response.json({ error: 'At least one valid event is required' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO webhooks (id, project_id, url, events, threshold, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(id, projectId, body.url, JSON.stringify(events), body.threshold ?? null).run();

  return Response.json({
    id, url: body.url, events, threshold: body.threshold ?? null,
  }, { status: 201 });
}

/** GET /v1/webhooks — list webhooks for a project. */
export async function handleWebhookList(env: Env, projectId: string): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT id, project_id, url, events, threshold, created_at
    FROM webhooks WHERE project_id = ? ORDER BY created_at DESC
  `).bind(projectId).all<WebhookRow>();
  return Response.json({ webhooks: (rows.results ?? []).map(toPayload) });
}

/** DELETE /v1/webhooks/:id — remove a webhook. */
export async function handleWebhookDelete(
  env: Env, projectId: string, id: string,
): Promise<Response> {
  const res = await env.DB.prepare(
    'DELETE FROM webhooks WHERE id = ? AND project_id = ?',
  ).bind(id, projectId).run();
  if (!res.success || (res.meta?.changes ?? 0) === 0) {
    return Response.json({ error: 'Webhook not found' }, { status: 404 });
  }
  return Response.json({ ok: true });
}

/** Build Slack-compatible blocks payload. */
function slackPayload(event: WebhookEvent, projectId: string, data: unknown): object {
  return {
    text: `ClawPipe alert: ${event}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `ClawPipe: ${event}` } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Project:*\n${projectId}` },
        { type: 'mrkdwn', text: `*Time:*\n${new Date().toISOString()}` },
      ] },
      { type: 'section', text: { type: 'mrkdwn', text: '```' + JSON.stringify(data, null, 2) + '```' } },
    ],
  };
}

/** Deliver an event to all matching webhooks for a project. Non-blocking. */
export async function deliverEvent(
  env: Env, projectId: string, event: WebhookEvent, data: unknown,
): Promise<void> {
  try {
    const rows = await env.DB.prepare(
      'SELECT id, project_id, url, events, threshold, created_at FROM webhooks WHERE project_id = ?',
    ).bind(projectId).all<WebhookRow>();
    const matches = (rows.results ?? []).filter((r) => {
      const evs = JSON.parse(r.events) as string[];
      return evs.includes(event);
    });
    await Promise.all(matches.map((hook) => {
      const isSlack = hook.url.includes('slack.com');
      const payload = isSlack
        ? slackPayload(event, projectId, data)
        : { event, project_id: projectId, timestamp: new Date().toISOString(), data };
      return fetch(hook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    }));
  } catch {
    // Non-blocking — webhook delivery failures never break the request path.
  }
}
