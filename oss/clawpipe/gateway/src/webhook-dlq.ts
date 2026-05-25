/** Webhook delivery durability — retry queue + dead-letter store.
 *
 * On failure, an exponential backoff schedule is set in `next_retry_at`.
 * The scheduled() handler calls `drainPending(env)` to fire due rows.
 * After `max_attempts` failures the row is parked as `dead` for manual
 * inspection / replay via `GET /v1/webhooks/dlq` + replay endpoint.
 */

import type { Env } from './types';
import { signPayload } from './webhook-emit';

export const MAX_ATTEMPTS = 5;
/** Backoff schedule (ms): 1m, 5m, 30m, 2h, 12h. */
export const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];
/** Cap on rows drained per scheduled tick to keep cron under the 30s budget. */
export const DRAIN_BATCH = 50;

export interface DeliveryRow {
  id: string;
  webhook_id: string;
  project_id: string;
  event: string;
  payload: string;
  attempts: number;
  max_attempts: number;
  status: 'pending' | 'success' | 'dead';
  last_error: string | null;
  next_retry_at: string | null;
}

/** ISO timestamp `attempts` ms in the future. attempts is 1-indexed. */
export function nextRetryAt(attempts: number, now: Date = new Date()): string | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const idx = Math.min(attempts, BACKOFF_MS.length - 1);
  return new Date(now.getTime() + BACKOFF_MS[idx]).toISOString();
}

/** Insert a new delivery row for a webhook. Returns the delivery id. */
export async function recordDelivery(
  env: Env, webhookId: string, projectId: string, event: string, payload: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO webhook_deliveries
       (id, webhook_id, project_id, event, payload, attempts, status, next_retry_at)
     VALUES (?, ?, ?, ?, ?, 0, 'pending', datetime('now'))`,
  ).bind(id, webhookId, projectId, event, payload).run();
  return id;
}

/** Mark a delivery as terminal-success. */
export async function markSuccess(env: Env, deliveryId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE webhook_deliveries
       SET status = 'success', updated_at = datetime('now'), next_retry_at = NULL
     WHERE id = ?`,
  ).bind(deliveryId).run();
}

/** Increment attempts; either schedule next retry or mark dead. */
export async function markFailure(
  env: Env, deliveryId: string, error: string, attempts: number,
): Promise<'pending' | 'dead'> {
  const next = nextRetryAt(attempts);
  const status = next === null ? 'dead' : 'pending';
  await env.DB.prepare(
    `UPDATE webhook_deliveries
       SET attempts = ?, last_error = ?, next_retry_at = ?, status = ?,
           updated_at = datetime('now')
     WHERE id = ?`,
  ).bind(attempts, error.slice(0, 500), next, status, deliveryId).run();
  return status;
}

/** POST the payload to the webhook URL with HMAC signature when present. */
async function sendOnce(
  url: string, secret: string | null, event: string,
  webhookId: string, deliveryId: string, payload: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-ClawPipe-Event': event,
      'X-ClawPipe-Webhook-Id': webhookId,
      'X-ClawPipe-Delivery-Id': deliveryId,
    };
    if (secret) headers['X-ClawPipe-Signature'] = await signPayload(secret, payload);
    const res = await fetch(url, { method: 'POST', headers, body: payload });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Attempt a delivery once and update its row. Returns final status. */
export async function attemptDelivery(
  env: Env, row: DeliveryRow,
): Promise<'success' | 'pending' | 'dead'> {
  const hook = await env.DB.prepare(
    'SELECT url, secret FROM webhooks WHERE id = ?',
  ).bind(row.webhook_id).first<{ url: string; secret: string | null }>();
  if (!hook) {
    await markFailure(env, row.id, 'webhook deleted', row.attempts + 1);
    return 'pending';
  }
  const result = await sendOnce(hook.url, hook.secret, row.event, row.webhook_id, row.id, row.payload);
  const attempts = row.attempts + 1;
  if (result.ok) { await markSuccess(env, row.id); return 'success'; }
  return await markFailure(env, row.id, result.error ?? 'unknown', attempts);
}

/** Drain rows whose next_retry_at is due. Returns counts. Bounded by DRAIN_BATCH. */
export async function drainPending(env: Env): Promise<{ tried: number; sent: number; dead: number }> {
  const due = await env.DB.prepare(
    `SELECT id, webhook_id, project_id, event, payload, attempts, max_attempts,
            status, last_error, next_retry_at
       FROM webhook_deliveries
      WHERE status = 'pending'
        AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
      ORDER BY created_at ASC
      LIMIT ?`,
  ).bind(DRAIN_BATCH).all<DeliveryRow>();

  const rows = due.results ?? [];
  let sent = 0, dead = 0;
  for (const row of rows) {
    const status = await attemptDelivery(env, row);
    if (status === 'success') sent++;
    else if (status === 'dead') dead++;
  }
  return { tried: rows.length, sent, dead };
}

/** Manually replay a row (typically a `dead` one). Resets attempts to 0. */
export async function replayDelivery(env: Env, deliveryId: string): Promise<DeliveryRow | null> {
  await env.DB.prepare(
    `UPDATE webhook_deliveries
       SET attempts = 0, status = 'pending', next_retry_at = datetime('now'),
           last_error = NULL, updated_at = datetime('now')
     WHERE id = ?`,
  ).bind(deliveryId).run();
  return await env.DB.prepare(
    `SELECT id, webhook_id, project_id, event, payload, attempts, max_attempts,
            status, last_error, next_retry_at
       FROM webhook_deliveries WHERE id = ?`,
  ).bind(deliveryId).first<DeliveryRow>();
}
