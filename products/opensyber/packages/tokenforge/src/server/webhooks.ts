/**
 * Webhook receiver helpers for TokenForge cloud deliveries.
 *
 * Every delivery carries three relevant headers:
 *   X-TF-Signature: "v1,<hex>" (one or more, space-separated during rotation)
 *   X-TF-Timestamp: ISO-8601 string — the moment dispatcher built the payload
 *   X-TF-Delivery-Id: UUID — per-attempt id, use for idempotency
 *
 * The signed string is `${timestamp}.${rawBody}` (no whitespace). During
 * rotation, the dispatcher may send two `v1,<hex>` signatures — accept if
 * either matches.
 *
 * Example (Node.js, Hono):
 *
 *   import { verifyWebhookSignature } from '@opensyber/tokenforge/webhooks';
 *
 *   app.post('/webhooks/tokenforge', async (c) => {
 *     const rawBody = await c.req.text();
 *     const ok = await verifyWebhookSignature({
 *       body: rawBody,
 *       signatureHeader: c.req.header('X-TF-Signature') ?? '',
 *       timestampHeader: c.req.header('X-TF-Timestamp') ?? '',
 *       secret: c.env.TOKENFORGE_WEBHOOK_SECRET,
 *     });
 *     if (!ok) return c.json({ error: 'bad_signature' }, 401);
 *     const event = JSON.parse(rawBody);
 *     // handle event.event, event.data ...
 *     return c.json({ received: true });
 *   });
 */

export interface VerifyOptions {
  body: string;
  signatureHeader: string;
  timestampHeader: string;
  secret: string;
  /** Max allowed clock skew in ms. Default 300000 (5 min). */
  toleranceMs?: number;
  /** Accept requests with missing timestamp (legacy). Default false. */
  allowMissingTimestamp?: boolean;
}

export async function verifyWebhookSignature(opts: VerifyOptions): Promise<boolean> {
  const { body, signatureHeader, timestampHeader, secret } = opts;
  const tolerance = opts.toleranceMs ?? 5 * 60_000;

  if (!signatureHeader || !secret) return false;

  if (!timestampHeader) {
    if (!opts.allowMissingTimestamp) return false;
  } else {
    const ts = Date.parse(timestampHeader);
    if (Number.isNaN(ts)) return false;
    if (Math.abs(Date.now() - ts) > tolerance) return false;
  }

  const signedString = timestampHeader ? `${timestampHeader}.${body}` : body;
  const expected = await hmacSha256Hex(secret, signedString);

  // Signature header is space-separated list of "v1,<hex>" entries.
  const entries = signatureHeader.split(/\s+/).filter(Boolean);
  for (const entry of entries) {
    const [version, hex] = entry.split(',');
    if (version !== 'v1' || !hex) continue;
    if (timingSafeEqual(hex.toLowerCase(), expected)) return true;
  }
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
