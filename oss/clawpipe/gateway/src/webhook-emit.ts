/** Outbound webhook dispatcher with HMAC-SHA256 signing. */

import type { Env } from './types';

const WEBHOOK_EVENTS = [
  'budget.threshold.crossed',
  'anomaly.detected',
  'digest.sent',
  'member.invited',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compute sha256=<hex> of the payload with the per-webhook secret. */
export async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `sha256=${hex(sig)}`;
}

/** Does the event array (CSV in DB) include the requested event? '*' matches all. */
export function eventsMatch(eventsCsv: string, event: WebhookEvent): boolean {
  const items = eventsCsv.split(',').map((s) => s.trim()).filter(Boolean);
  return items.includes('*') || items.includes(event);
}

/** Fire the event to every matching webhook for a project.
 *  Each attempt is recorded in `webhook_deliveries` and retried by the
 *  scheduled() cron via `drainPending`. The first attempt is synchronous so
 *  callers still see a fast-path success count. */
export async function emitWebhook(
  env: Env, projectId: string, event: WebhookEvent, data: Record<string, unknown>,
): Promise<{ sent: number; failed: number; queued: number }> {
  const hooks = await env.DB.prepare(
    'SELECT id, url, events, secret FROM webhooks WHERE project_id = ?',
  ).bind(projectId).all<{ id: string; url: string; events: string; secret: string | null }>();

  const matching = (hooks.results ?? []).filter((h) => eventsMatch(h.events, event));
  if (matching.length === 0) return { sent: 0, failed: 0, queued: 0 };

  const payload = JSON.stringify({
    event, project_id: projectId, emitted_at: new Date().toISOString(), data,
  });

  // Lazy import — avoids a circular dependency between webhook-emit and webhook-dlq.
  const { recordDelivery, attemptDelivery } = await import('./webhook-dlq');

  let sent = 0, failed = 0, queued = 0;
  for (const h of matching) {
    const id = await recordDelivery(env, h.id, projectId, event, payload);
    const status = await attemptDelivery(env, {
      id, webhook_id: h.id, project_id: projectId, event, payload,
      attempts: 0, max_attempts: 5, status: 'pending',
      last_error: null, next_retry_at: null,
    });
    if (status === 'success') sent++;
    else { failed++; if (status === 'pending') queued++; }
  }
  return { sent, failed, queued };
}

export { WEBHOOK_EVENTS };
