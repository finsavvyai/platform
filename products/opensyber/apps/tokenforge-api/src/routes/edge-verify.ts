import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { deviceSessions } from '@opensyber/db';
import { TrustScoreEngine, importPublicKey, verifySignature } from '@opensyber/tokenforge/server/internal';
import type { Env, Variables } from '../types.js';
import { incrementUsage } from '../lib/usage.js';
import { dispatchAlerts } from '../services/alert-dispatch.js';
import { dispatchWebhook } from '../services/webhook-dispatch.js';
import { verifyEdgeSignature } from '../services/edge/sig-verify.js';
import { resolveStepUpVerdict } from '../services/step-up/loader.js';

const edgeVerifySchema = z.object({
  path: z.string(),
  method: z.string(),
  headers: z.object({
    signature: z.string().nullable(),
    nonce: z.string().nullable(),
    timestamp: z.string().nullable(),
    deviceId: z.string().nullable(),
    jws: z.string().nullable().optional(),
  }),
  ipAddress: z.string().optional().default(''),
  countryCode: z.string().optional().default(''),
  userAgent: z.string().optional().default(''),
  sessionId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
});

export const edgeVerifyRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const trustEngine = new TrustScoreEngine();

/**
 * POST /v1/edge/verify — full request verification for SDK middleware.
 * The SDK sends request context, the API does all verification and returns the decision.
 */
edgeVerifyRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const parseResult = edgeVerifySchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: 'validation_error', message: 'Invalid request' }, 400);
  }

  const { path, method, headers, ipAddress, countryCode, userAgent, sessionId, userId } = parseResult.data;
  const { signature, nonce, timestamp, deviceId, jws } = headers;

  const blockAlert = (reason: string): void => {
    c.executionCtx.waitUntil(
      dispatchAlerts(tenantId, { type: 'trust.block', reason, deviceId: deviceId ?? undefined, ip: ipAddress, country: countryCode }, c.env),
    );
  };
  const blockResp = (reason: string): Response =>
    c.json({ data: { status: 'block', trustScore: 0, deviceId, bound: false, reason } });

  // No TF headers = degraded mode (no device binding). Either legacy
  // signature OR JWS is sufficient evidence the SDK attempted binding.
  if (!deviceId || (!signature && !jws)) {
    c.executionCtx.waitUntil(incrementUsage(db, tenantId, 'verification'));
    return c.json({
      data: { status: 'degraded', trustScore: 0, deviceId: null, bound: false, message: 'No device binding headers present' },
    });
  }

  // Timestamp + nonce replay only apply to the legacy header triple — the
  // JWS path delegates iat/exp to the JWS verifier.
  const ts = parseInt(timestamp ?? '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (!jws) {
    if (Math.abs(now - ts) > 60) {
      blockAlert('timestamp_skew');
      return blockResp('timestamp_skew');
    }
    const nonceKey = `nonce:${tenantId}:${nonce}`;
    if (await c.env.CACHE.get(nonceKey)) {
      blockAlert('nonce_replay');
      return blockResp('nonce_replay');
    }
    c.executionCtx.waitUntil(c.env.CACHE.put(nonceKey, '1', { expirationTtl: 65 }));
  }

  const rows = await db
    .select()
    .from(deviceSessions)
    .where(and(eq(deviceSessions.id, deviceId), eq(deviceSessions.tenantId, tenantId)));
  if (rows.length === 0) { blockAlert('device_not_found'); return blockResp('device_not_found'); }
  const session = rows[0]!;
  if (session.revoked === 1) { blockAlert('session_revoked'); return blockResp('session_revoked'); }
  if (new Date(session.expiresAt) < new Date()) { blockAlert('session_expired'); return blockResp('session_expired'); }

  // Signature verification — JWS-aware via the helper. Falls back to
  // legacy ECDSA-over-`${sid}:${nonce}:${ts}` when no JWS is supplied.
  let signatureValid = false;
  if (jws) {
    const verdict = await verifyEdgeSignature(
      { sessionId: session.sessionId, publicKey: session.publicKey },
      { signature: null, nonce: null, timestamp: null, jws },
    );
    signatureValid = verdict.ok;
  } else {
    try {
      const publicKey = await importPublicKey(session.publicKey);
      const payload = `${session.sessionId}:${nonce}:${ts}`;
      signatureValid = await verifySignature(publicKey, signature!, payload);
    } catch { signatureValid = false; }
  }

  // Compute trust score
  const signals = {
    signatureValid,
    ipAddress,
    originalIp: session.ipAddress ?? '',
    countryCode,
    originalCountry: session.countryCode ?? '',
    userAgent,
    originalFingerprint: session.deviceFingerprint ?? '',
    requestTimestamp: ts,
    sessionCreatedAt: new Date(session.boundAt).getTime() / 1000,
  };

  const trustScore = trustEngine.compute(signals);

  // Update session
  c.executionCtx.waitUntil(
    db.update(deviceSessions)
      .set({ trustScore, lastVerifiedAt: new Date().toISOString() })
      .where(eq(deviceSessions.id, session.id)),
  );

  c.executionCtx.waitUntil(incrementUsage(db, tenantId, 'verification'));

  // Decision
  let status: 'allow' | 'step_up' | 'block' = 'allow';
  if (trustScore < 40) status = 'block';
  else if (trustScore < 80) status = 'step_up';

  // Per-action step-up policy upgrade: a path that requires a fresh JWS
  // but received only the legacy header triple gets bumped to step_up.
  const stepUp = await resolveStepUpVerdict(db, tenantId, path);
  if (stepUp.matched && stepUp.requireFreshSig && !jws && status === 'allow') {
    status = 'step_up';
  }

  // Dispatch alerts for block/step_up decisions (non-blocking)
  if (status === 'block' || status === 'step_up') {
    c.executionCtx.waitUntil(
      dispatchAlerts(tenantId, {
        type: `trust.${status}`,
        trustScore,
        deviceId,
        ip: ipAddress,
        country: countryCode,
      }, c.env),
    );
  }

  // Mirror decision into webhook stream so integrators see edge-path events too.
  const wp = { deviceId: session.id, sessionId: session.sessionId, userId: session.userId, trustScore, ipAddress, countryCode, userAgent, decision: status };
  c.executionCtx.waitUntil(dispatchWebhook(db, tenantId, 'session.verified', wp));
  if (!signatureValid) c.executionCtx.waitUntil(dispatchWebhook(db, tenantId, 'session.hijack_attempt', { ...wp, reason: 'signature_invalid' }));

  return c.json({
    data: {
      status,
      trustScore,
      deviceId: session.id,
      bound: true,
      userId: session.userId,
      sessionId: session.sessionId,
    },
  });
});
