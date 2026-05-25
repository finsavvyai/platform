/**
 * LemonSqueezy webhook handler.
 * - Verifies X-Signature (HMAC-SHA256, constant-time compare via crypto.subtle.verify).
 * - Idempotent via billing_events.ls_event_id UNIQUE.
 * - Dispatches to tier-sync handlers.
 */

import type { Env } from '../types';
import type { LSWebhookEvent } from './types';
import { applyEvent, buildVariantMap } from './tier-sync';

interface LSWebhookEnv {
  LEMONSQUEEZY_WEBHOOK_SECRET?: string;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('sha256=') ? hex.slice(7) : hex;
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) return new Uint8Array(0);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Real HMAC-SHA256 verification with constant-time compare via crypto.subtle.verify. */
export async function verifyLSSignature(
  body: string, signature: string, secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const sigBytes = hexToBytes(signature);
  if (sigBytes.length === 0) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes as BufferSource,
    new TextEncoder().encode(body) as BufferSource,
  );
}

/** Try to insert billing_events row. Returns true if inserted, false if duplicate. */
async function recordEvent(
  env: Env, lsEventId: string, projectId: string, eventType: string, payload: string,
): Promise<boolean> {
  try {
    await env.DB.prepare(
      `INSERT INTO billing_events (id, project_id, event_type, ls_event_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      projectId,
      eventType,
      lsEventId,
      payload,
      Math.floor(Date.now() / 1000),
    ).run();
    return true;
  } catch (err) {
    // SQLite UNIQUE violation on ls_event_id -> idempotent replay.
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/i.test(msg)) return false;
    throw err;
  }
}

/** Main webhook entry point. Returns 401/200/500 per spec. */
export async function handleLSWebhook(env: Env, request: Request): Promise<Response> {
  const sig = request.headers.get('X-Signature') ?? '';
  const body = await request.text();
  const secret = (env as unknown as LSWebhookEnv).LEMONSQUEEZY_WEBHOOK_SECRET ?? '';

  if (!sig) return Response.json({ error: 'Missing signature' }, { status: 401 });

  const valid = await verifyLSSignature(body, sig, secret).catch(() => false);
  if (!valid) return Response.json({ error: 'Invalid signature' }, { status: 401 });

  let evt: LSWebhookEvent;
  try {
    evt = JSON.parse(body) as LSWebhookEvent;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventName = evt.meta?.event_name ?? 'unknown';
  const lsEventId = `${eventName}:${evt.data?.id ?? ''}`;
  const projectId = evt.meta?.custom_data?.project_id ?? '';

  const fresh = await recordEvent(env, lsEventId, projectId, eventName, body);
  if (!fresh) {
    // Already processed — ack idempotently.
    return Response.json({ ok: true, duplicate: true }, { status: 200 });
  }

  try {
    const map = buildVariantMap(env);
    const result = await applyEvent(env, evt, map);
    return Response.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'handler_failed', detail: msg }, { status: 500 });
  }
}
