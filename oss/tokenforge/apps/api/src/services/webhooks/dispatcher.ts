/**
 * Webhook dispatcher.
 *
 * `signWebhook` produces an HMAC-SHA256 signature over the canonical
 * JSON body so the receiver can verify with a shared secret. The
 * `deliverWebhook` helper handles 3 attempts with exponential backoff
 * and is intentionally pure-fetch — Cloudflare Queues wraps this in
 * Phase 7.1 for at-least-once durability.
 */

const HEADER_SIG = 'X-TokenForge-Signature';
const HEADER_TS = 'X-TokenForge-Timestamp';
const HEADER_EVENT = 'X-TokenForge-Event';

export interface DeliverInput {
  url: string;
  secret: string;
  event: string;
  body: Record<string, unknown>;
  fetchImpl?: typeof globalThis.fetch;
  attempts?: number;
  backoffBaseMs?: number;
}

export interface DeliverResult {
  ok: boolean;
  status?: number;
  attempts: number;
  error?: string;
}

export async function signWebhook(secret: string, body: string, timestamp: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`) as BufferSource);
  return base64UrlBytes(new Uint8Array(sig));
}

export async function verifyWebhook(
  secret: string,
  body: string,
  timestamp: string,
  signature: string,
): Promise<boolean> {
  const expected = await signWebhook(secret, body, timestamp);
  return timingSafeEqual(expected, signature);
}

export async function deliverWebhook(input: DeliverInput): Promise<DeliverResult> {
  const fetchFn = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const attempts = input.attempts ?? 3;
  const backoffBase = input.backoffBaseMs ?? 200;
  const ts = String(Math.floor(Date.now() / 1000));
  const bodyStr = JSON.stringify(input.body);
  const sig = await signWebhook(input.secret, bodyStr, ts);

  let lastError = '';
  let lastStatus: number | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchFn(input.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [HEADER_SIG]: sig,
          [HEADER_TS]: ts,
          [HEADER_EVENT]: input.event,
        },
        body: bodyStr,
      });
      lastStatus = res.status;
      if (res.ok) return { ok: true, status: res.status, attempts: i + 1 };
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { ok: false, status: res.status, attempts: i + 1, error: 'client_error' };
      }
    } catch (e) {
      lastError = (e as Error).message;
    }
    if (i < attempts - 1) await sleep(backoffBase * 2 ** i);
  }
  return { ok: false, status: lastStatus, attempts, error: lastError || 'retries_exhausted' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64UrlBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
