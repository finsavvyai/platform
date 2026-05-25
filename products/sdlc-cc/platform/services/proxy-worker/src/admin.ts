/**
 * Admin endpoint — HMAC-signed plan updates posted by the Lemon Squeezy
 * webhook in the landing-page edge function (and potentially a future
 * admin UI). Rejects any request whose X-Admin-Signature doesn't match
 * the HMAC-SHA256 of the raw body under ADMIN_HMAC_SECRET.
 *
 * The signature is computed on the raw request body (not a re-serialized
 * JSON) so signer + verifier stay byte-identical. Callers are required to
 * buffer the payload once, sign it, and POST it unmodified.
 */

import { setTenantPlan, type TenantPlanRecord } from './tenant-plan';

interface SetPlanBody {
  userId?: string;
  plan?: string;
  source?: TenantPlanRecord['source'];
  reference?: string;
}

/**
 * verifyHmac returns true iff `X-Admin-Signature: sha256=<hex>` matches
 * the HMAC of body under secret. Constant-time comparison.
 */
export async function verifyHmac(
  secret: string,
  body: string,
  headerValue: string
): Promise<boolean> {
  if (!headerValue.startsWith('sha256=')) return false;
  const provided = headerValue.slice('sha256='.length);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

const ALLOWED_PLANS = new Set(['free', 'startup', 'team', 'pro', 'enterprise']);

/**
 * handleAdminSetPlan is the entry point mounted at POST /admin/plans.
 */
export async function handleAdminSetPlan(
  request: Request,
  kv: KVNamespace,
  secret: string
): Promise<Response> {
  if (!secret) {
    return json(503, { error: 'admin endpoint disabled' });
  }
  if (request.method !== 'POST') {
    return json(405, { error: 'method not allowed' });
  }

  const body = await request.text();
  const sig = request.headers.get('X-Admin-Signature') ?? '';
  if (!(await verifyHmac(secret, body, sig))) {
    return json(401, { error: 'invalid signature' });
  }

  let parsed: SetPlanBody;
  try {
    parsed = JSON.parse(body) as SetPlanBody;
  } catch {
    return json(400, { error: 'invalid JSON' });
  }

  const userId = parsed.userId?.trim();
  const plan = parsed.plan?.trim().toLowerCase();
  if (!userId || !plan) {
    return json(400, { error: 'userId and plan required' });
  }
  if (!ALLOWED_PLANS.has(plan)) {
    return json(400, { error: `plan must be one of ${[...ALLOWED_PLANS].join(', ')}` });
  }

  await setTenantPlan(kv, userId, {
    plan,
    updatedAt: Date.now(),
    source: parsed.source ?? 'admin',
    reference: parsed.reference,
  });

  return json(200, { ok: true, userId, plan });
}

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
