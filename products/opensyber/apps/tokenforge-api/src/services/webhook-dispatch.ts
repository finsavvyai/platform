import { eq, and } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '@opensyber/db';
import { tfWebhookConfig, tfWebhookDeliveries } from '@opensyber/db';

type Db = DrizzleD1Database<typeof schema>;

export type WebhookEvent =
  | 'session.bound'
  | 'session.verified'
  | 'session.revoked'
  | 'trust_score.degraded'
  | 'trust_score.critical'
  | 'session.hijack_attempt'
  | 'usage.cap_exceeded'
  | 'dbsc.risk_signal'
  | 'dbsc.policy_block'
  | 'dbsc.session_step_up'
  | 'dbsc.session_revoked'
  | 'webhook.test';

export interface WebhookPayload {
  event: WebhookEvent;
  tenantId: string;
  timestamp: string;
  deliveryId: string;
  data: Record<string, unknown>;
}

const DELIVERY_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [1_000, 4_000, 15_000];

/**
 * Fan-out an event to every enabled webhook subscribed to this event type for
 * the tenant. Each delivery carries an `X-TF-Timestamp` header and the
 * signature is `HMAC-SHA256(secret, timestamp + "." + body)` as hex so that
 * captured payloads can't be replayed after the freshness window expires.
 *
 * Always call via `c.executionCtx.waitUntil(dispatchWebhook(...))`.
 */
export async function dispatchWebhook(
  db: Db,
  tenantId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const rows = await db
    .select()
    .from(tfWebhookConfig)
    .where(and(eq(tfWebhookConfig.tenantId, tenantId), eq(tfWebhookConfig.enabled, 1)));

  const subscribed = rows.filter((r) =>
    (r.events ?? '').split(',').filter(Boolean).includes(event),
  );
  if (subscribed.length === 0) return;

  await Promise.all(subscribed.map((hook) => deliverOne(db, hook, event, tenantId, data)));
}

async function deliverOne(
  db: Db,
  hook: typeof tfWebhookConfig.$inferSelect,
  event: WebhookEvent,
  tenantId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const deliveryId = crypto.randomUUID();
  const payload: WebhookPayload = { event, tenantId, timestamp, deliveryId, data };
  const body = JSON.stringify(payload);

  // Sign with current + (if within grace) previous secret. Receiver accepts
  // either — this lets integrators rotate secrets without dropped events.
  const sigs = await buildSignatures(hook, timestamp, body);

  let attempt = 0;
  let finalStatus = 0;
  let finalError: string | null = null;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    const { status, error } = await attemptDelivery(hook.endpointUrl, body, sigs, event, deliveryId, timestamp);
    finalStatus = status;
    finalError = error;

    const succeeded = status >= 200 && status < 300;
    const nextBackoff = BACKOFF_MS[attempt - 1];
    const willRetry = !succeeded && attempt < MAX_ATTEMPTS && nextBackoff !== undefined;

    await db.insert(tfWebhookDeliveries).values({
      id: crypto.randomUUID(),
      webhookId: hook.id,
      tenantId,
      event,
      payload: body,
      attempt,
      status: status || null,
      error,
      scheduledAt: new Date().toISOString(),
      deliveredAt: succeeded ? new Date().toISOString() : null,
      nextRetryAt: willRetry ? new Date(Date.now() + nextBackoff).toISOString() : null,
    });

    if (succeeded) break;
    if (!willRetry) break;
    await new Promise((r) => setTimeout(r, nextBackoff));
  }

  await db
    .update(tfWebhookConfig)
    .set({
      lastDeliveryAt: new Date().toISOString(),
      lastDeliveryStatus: finalStatus || null,
    })
    .where(eq(tfWebhookConfig.id, hook.id));

  if (finalError) {
    console.warn(`[webhook-dispatch] ${hook.id} ${event} exhausted retries: ${finalError}`);
  }
}

async function buildSignatures(
  hook: typeof tfWebhookConfig.$inferSelect,
  timestamp: string,
  body: string,
): Promise<string> {
  const parts: string[] = [];
  if (hook.secret) parts.push(`v1,${await hmacSha256Hex(hook.secret, `${timestamp}.${body}`)}`);
  if (
    hook.secretPrevious &&
    hook.secretPreviousValidUntil &&
    new Date(hook.secretPreviousValidUntil).getTime() > Date.now()
  ) {
    parts.push(`v1,${await hmacSha256Hex(hook.secretPrevious, `${timestamp}.${body}`)}`);
  }
  return parts.join(' ');
}

async function attemptDelivery(
  url: string,
  body: string,
  signatures: string,
  event: string,
  deliveryId: string,
  timestamp: string,
): Promise<{ status: number; error: string | null }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TF-Signature': signatures,
        'X-TF-Timestamp': timestamp,
        'X-TF-Event': event,
        'X-TF-Delivery-Id': deliveryId,
        'User-Agent': 'TokenForge-Webhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    return { status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += (bytes[i] as number).toString(16).padStart(2, '0');
  return hex;
}

/**
 * Trust-score transition helpers — only fire the webhook on threshold crossings
 * so high-frequency verify traffic doesn't spam subscribers.
 */
export function crossedDegraded(before: number, after: number): boolean {
  return before >= 70 && after < 70 && after >= 40;
}

export function crossedCritical(before: number, after: number): boolean {
  return before >= 40 && after < 40;
}
