import { importPublicKey, verifySignature } from './crypto.js';
import { verifyWebAuthnAssertion } from './webauthn-verify.js';
import { TrustScoreEngine } from './trust-score.js';
import { verifyDbscCookie, type DbscCheckResult } from './dbsc-verify.js';
import { emptyHistogram, recordActivity } from './activity-histogram.js';
import type { TokenForgeServerOptions, SecurityEvent, SecurityEventType } from '../shared/types.js';
import { shouldSkip, isSensitiveOp } from './middleware.js';

const trustEngine = new TrustScoreEngine();

/** Headers extracted from the incoming request. */
export interface TfHeaders {
  signature: string | null; nonce: string | null;
  timestamp: string | null; deviceId: string | null;
  authData?: string | null; clientDataJSON?: string | null;
  origin?: string | null; version?: string | null;
  bodyHash?: string | null; cookie?: string | null;
}

/** Request context from the framework adapter. */
export interface TfRequestContext {
  path: string; method: string; userId: string | null; sessionId: string | null;
  ipAddress: string; countryCode: string; userAgent: string;
  headers: TfHeaders; requestBody?: string | null;
}

/** DBSC flags attached to successful or degraded results. */
export interface DbscFlags {
  cookieValid: boolean; rotateCookie: boolean; reason?: 'cookie_missing' | 'cookie_invalid';
}

/** Result of the verification pipeline. */
export type VerifyResult =
  | { status: 'skip' }
  | { status: 'degraded'; sensitive: boolean; dbsc?: DbscFlags }
  | { status: 'error'; code: number; body: Record<string, unknown> }
  | { status: 'ok'; trustScore: number; deviceId: string; bound: true; dbsc?: DbscFlags };

/** Framework-agnostic verification pipeline. */
export async function verifyRequest(
  ctx: TfRequestContext,
  options: TokenForgeServerOptions,
): Promise<VerifyResult> {
  if (shouldSkip(ctx.path, options.skipPaths)) return { status: 'skip' };
  if (ctx.path === '/api/tf/bind' && ctx.method === 'POST') return { status: 'skip' };
  if (ctx.path.startsWith('/api/tf/')) return { status: 'skip' };

  const { signature, nonce, timestamp, deviceId } = ctx.headers;

  if (!signature || !nonce || !timestamp || !deviceId) {
    const sensitive = isSensitiveOp(ctx.path, ctx.method, options.sensitiveOps);
    if (sensitive) {
      return { status: 'error', code: 403, body: { error: 'device_binding_required', action: 'bind', message: 'This operation requires device verification' } };
    }
    return { status: 'degraded', sensitive: false };
  }

  if (!ctx.userId || !ctx.sessionId) {
    return { status: 'error', code: 401, body: { error: 'unauthorized' } };
  }

  // 1. Nonce validation
  if (await options.storage.hasNonce(nonce)) {
    await logEvent(options, ctx, 'NONCE_REPLAY', { nonce });
    return { status: 'error', code: 401, body: { error: 'nonce_replay', action: 'session_revoked' } };
  }
  await options.storage.storeNonce(nonce, options.nonceExpiry * 2);

  // 2. Timestamp validation
  const requestTimestamp = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - requestTimestamp) > options.nonceExpiry) {
    await logEvent(options, ctx, 'TIMESTAMP_SKEW', { requestTime: requestTimestamp, serverTime: now });
    return { status: 'error', code: 400, body: { error: 'request_expired', action: 'retry' } };
  }

  // 3. Lookup device session
  const session = await options.storage.getSession(ctx.sessionId, deviceId);
  if (!session) {
    await logEvent(options, ctx, 'DEVICE_NOT_FOUND', { deviceId });
    return { status: 'error', code: 401, body: { error: 'device_not_bound', action: 'rebind' } };
  }

  // 4. Session expiry
  if (new Date(session.expires_at) < new Date()) {
    await logEvent(options, ctx, 'SESSION_EXPIRED', { deviceId });
    return { status: 'error', code: 401, body: { error: 'session_expired', action: 'reauth' } };
  }

  // 5. Verify signature — WebAuthn or ECDSA branch
  const isWebAuthn = !!ctx.headers.authData && !!ctx.headers.clientDataJSON;
  const isV2 = ctx.headers.version === '2';
  const sigOk = isWebAuthn
    ? await verifyWebAuthnBranch(ctx, session.public_key, signature, nonce, timestamp)
    : await verifyEcdsaBranch(
        session.public_key, signature, ctx.sessionId, nonce, timestamp,
        isV2 ? ctx : undefined,
      );
  if (!sigOk) {
    await logEvent(options, ctx, 'SIGNATURE_INVALID', { deviceId });
    await options.storage.revokeSession(deviceId, 'invalid_signature');
    return { status: 'error', code: 401, body: { error: 'signature_invalid', action: 'session_revoked' } };
  }

  // 5b. DBSC bound-cookie check (additive — never blocks if ECDSA passed)
  let dbscFlags: DbscFlags | undefined;
  if (options.dbsc?.enabled) {
    const dr = await verifyDbscCookie(ctx.headers.cookie ?? null, session, options.dbsc);
    dbscFlags = { cookieValid: dr.cookieValid, rotateCookie: dr.rotateCookie, reason: dr.reason };
    if (dr.reason) {
      const evt = dr.reason === 'cookie_missing' ? 'DBSC_COOKIE_MISSING' : 'DBSC_COOKIE_INVALID';
      await logEvent(options, ctx, evt, { deviceId, reason: dr.reason });
    }
  }

  // 6. Load activity histogram + compute trust score
  const histogram = await options.storage.getActivityHistogram(ctx.userId) ?? emptyHistogram();
  const signals = {
    signatureValid: true, ipAddress: ctx.ipAddress, originalIp: session.ip_address ?? '',
    countryCode: ctx.countryCode, originalCountry: session.country_code ?? '',
    userAgent: ctx.userAgent, originalFingerprint: session.device_fingerprint ?? '',
    requestTimestamp, sessionCreatedAt: new Date(session.bound_at).getTime() / 1000,
    activityHistogram: histogram,
  };
  const trustScore = trustEngine.compute(signals);
  const previousScore = session.trust_score;
  await options.storage.updateTrustScore(deviceId, trustScore);

  // 6b. Record activity in histogram for future scoring
  const requestHour = new Date(requestTimestamp * 1000).getUTCHours();
  const updated = recordActivity(histogram, requestHour);
  await options.storage.setActivityHistogram(ctx.userId, updated);

  // 7. Enforce thresholds
  if (trustScore < options.trustThresholds.stepUp) {
    await options.storage.revokeSession(deviceId, 'trust_score_critical');
    await logEvent(options, ctx, 'SESSION_REVOKED', { trustScore, previousScore });
    return { status: 'error', code: 401, body: { error: 'trust_too_low', action: 'session_revoked' } };
  }
  if (trustScore < options.trustThresholds.allow) {
    await logEvent(options, ctx, 'STEP_UP_TRIGGERED', { trustScore, previousScore });
    return { status: 'error', code: 403, body: { error: 'step_up_required', action: 'step_up_required', reason: trustEngine.getDropReasons(signals), trustScore } };
  }
  if (isSensitiveOp(ctx.path, ctx.method, options.sensitiveOps) && trustScore < 90) {
    return { status: 'error', code: 403, body: { error: 'elevated_trust_required', action: 'step_up_required', reason: 'sensitive_operation', trustScore } };
  }

  if (Math.abs(trustScore - previousScore) > 10)
    await logEvent(options, ctx, 'TRUST_SCORE_CHANGE', { trustScore, previousScore, delta: trustScore - previousScore });
  return { status: 'ok', trustScore, deviceId, bound: true, dbsc: dbscFlags };
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** ECDSA v1: `sessionId:nonce:ts`, v2: `method:path:bodyHash:sessionId:nonce:ts`. */
async function verifyEcdsaBranch(
  publicKeyJson: string, signature: string,
  sessionId: string, nonce: string, timestamp: string, v2Ctx?: TfRequestContext,
): Promise<boolean> {
  const publicKey = await importPublicKey(publicKeyJson);
  if (!v2Ctx) return verifySignature(publicKey, signature, `${sessionId}:${nonce}:${timestamp}`);
  const actualBodyHash = await sha256Hex(v2Ctx.requestBody ?? '');
  if (v2Ctx.headers.bodyHash && v2Ctx.headers.bodyHash !== actualBodyHash) return false;
  const payload = `${v2Ctx.method}:${v2Ctx.path}:${actualBodyHash}:${sessionId}:${nonce}:${timestamp}`;
  return verifySignature(publicKey, signature, payload);
}

async function verifyWebAuthnBranch(
  ctx: TfRequestContext, publicKeyJson: string,
  signature: string, nonce: string, timestamp: string,
): Promise<boolean> {
  if (!ctx.headers.authData || !ctx.headers.clientDataJSON || !ctx.headers.origin) return false;
  let jwk: JsonWebKey;
  try { jwk = JSON.parse(publicKeyJson) as JsonWebKey; } catch { return false; }
  const cb = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ctx.sessionId}:${nonce}:${timestamp}`));
  let s = '';
  for (const b of new Uint8Array(cb)) s += String.fromCharCode(b);
  const expected = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return verifyWebAuthnAssertion(signature, ctx.headers.authData, ctx.headers.clientDataJSON, jwk, expected, ctx.headers.origin);
}

async function logEvent(
  opts: TokenForgeServerOptions, ctx: TfRequestContext,
  type: SecurityEventType, metadata: Record<string, unknown>,
): Promise<void> {
  const event: SecurityEvent & { id: string } = {
    id: crypto.randomUUID(), sessionId: ctx.sessionId ?? '', userId: ctx.userId ?? '',
    eventType: type, trustScoreBefore: 0, trustScoreAfter: 0,
    ipAddress: ctx.ipAddress, countryCode: ctx.countryCode, userAgent: ctx.userAgent, metadata,
  };
  opts.onSecurityEvent?.(event).catch(console.error);
  await opts.storage.logEvent(event).catch(console.error);
}
