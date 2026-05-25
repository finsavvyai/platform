import type { Context, Next, MiddlewareHandler } from 'hono';
import { importPublicKey, verifySignature } from './crypto.js';
import { TrustScoreEngine } from './trust-score.js';
import type {
  TokenForgeServerOptions,
  SecurityEvent,
  SecurityEventType,
  DeviceSession,
} from '../shared/types.js';

/**
 * TokenForge Hono middleware — verifies device-bound session integrity
 * on every authenticated request.
 *
 * Must be mounted AFTER auth middleware (Clerk) so that userId/sessionId
 * are available on the context.
 * @param options - Server options (storage, thresholds, skip paths, callbacks).
 * @returns Hono middleware handler.
 */
export function tokenForgeMiddleware(
  options: TokenForgeServerOptions,
): MiddlewareHandler {
  const trustEngine = new TrustScoreEngine();

  return async (c: Context, next: Next) => {
    if (shouldSkip(c.req.path, options.skipPaths)) return next();
    if (c.req.path === '/api/tf/bind' && c.req.method === 'POST') return next();
    if (c.req.path.startsWith('/api/tf/')) return next();

    const signature = c.req.header('X-TF-Signature');
    const nonce = c.req.header('X-TF-Nonce');
    const timestamp = c.req.header('X-TF-Timestamp');
    const deviceId = c.req.header('X-TF-Device-ID');

    if (!signature || !nonce || !timestamp || !deviceId) {
      c.set('tf_bound', false);
      c.set('tf_trust_score', 0);
      if (isSensitiveOp(c.req.path, c.req.method, options.sensitiveOps)) {
        return c.json({ error: 'device_binding_required', action: 'bind', message: 'This operation requires device verification' }, 403);
      }
      return next();
    }

    const userId = c.get('userId') as string | undefined;
    const sessionId = c.get('sessionId') as string | undefined;
    if (!userId || !sessionId) return c.json({ error: 'unauthorized' }, 401);

    // 1. NONCE VALIDATION
    if (await options.storage.hasNonce(nonce)) {
      await logEvent(options, c, userId, sessionId, 'NONCE_REPLAY', { nonce });
      return c.json({ error: 'nonce_replay', action: 'session_revoked' }, 401);
    }
    await options.storage.storeNonce(nonce, options.nonceExpiry * 2);

    // 2. TIMESTAMP VALIDATION
    const requestTimestamp = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - requestTimestamp) > options.nonceExpiry) {
      await logEvent(options, c, userId, sessionId, 'TIMESTAMP_SKEW', {
        requestTime: requestTimestamp, serverTime: now, skew: Math.abs(now - requestTimestamp),
      });
      return c.json({ error: 'request_expired', action: 'retry' }, 400);
    }

    // 3. LOOKUP DEVICE SESSION
    const deviceSession = await options.storage.getSession(sessionId, deviceId);
    if (!deviceSession) {
      await logEvent(options, c, userId, sessionId, 'DEVICE_NOT_FOUND', { deviceId });
      return c.json({ error: 'device_not_bound', action: 'rebind' }, 401);
    }

    // 4. CHECK SESSION EXPIRY
    if (new Date(deviceSession.expires_at) < new Date()) {
      await logEvent(options, c, userId, sessionId, 'SESSION_EXPIRED', { deviceId });
      return c.json({ error: 'session_expired', action: 'reauth' }, 401);
    }

    // 5. VERIFY SIGNATURE
    const publicKey = await importPublicKey(deviceSession.public_key);
    const payload = `${sessionId}:${nonce}:${timestamp}`;
    const isValid = await verifySignature(publicKey, signature, payload);
    if (!isValid) {
      await logEvent(options, c, userId, sessionId, 'SIGNATURE_INVALID', { deviceId, payload: payload.substring(0, 50) });
      await options.storage.revokeSession(deviceId, 'invalid_signature');
      return c.json({ error: 'signature_invalid', action: 'session_revoked' }, 401);
    }

    // 6. COMPUTE TRUST SCORE
    const ipAddress = options.getIpAddress?.(c.req.raw) ?? c.req.header('cf-connecting-ip') ?? '';
    const countryCode = options.getCountryCode?.(c.req.raw) ?? c.req.header('cf-ipcountry') ?? '';
    const userAgent = options.getUserAgent?.(c.req.raw) ?? c.req.header('user-agent') ?? '';

    const signals = {
      signatureValid: true, ipAddress, originalIp: deviceSession.ip_address ?? '',
      countryCode, originalCountry: deviceSession.country_code ?? '',
      userAgent, originalFingerprint: deviceSession.device_fingerprint ?? '',
      requestTimestamp, sessionCreatedAt: new Date(deviceSession.bound_at).getTime() / 1000,
    };
    const trustScore = trustEngine.compute(signals);

    // 7. ACT ON TRUST SCORE
    const previousScore = deviceSession.trust_score;
    await options.storage.updateTrustScore(deviceId, trustScore);

    if (trustScore < options.trustThresholds.stepUp) {
      await options.storage.revokeSession(deviceId, 'trust_score_critical');
      await logEvent(options, c, userId, sessionId, 'SESSION_REVOKED', { trustScore, previousScore, reason: 'trust_score_below_threshold' });
      return c.json({ error: 'trust_too_low', action: 'session_revoked' }, 401);
    }

    if (trustScore < options.trustThresholds.allow) {
      await logEvent(options, c, userId, sessionId, 'STEP_UP_TRIGGERED', { trustScore, previousScore });
      return c.json({ error: 'step_up_required', action: 'step_up_required', reason: trustEngine.getDropReasons(signals), trustScore }, 403);
    }

    if (isSensitiveOp(c.req.path, c.req.method, options.sensitiveOps) && trustScore < 90) {
      return c.json({ error: 'elevated_trust_required', action: 'step_up_required', reason: 'sensitive_operation', trustScore }, 403);
    }

    // 8. ALL GOOD
    c.set('tf_bound', true);
    c.set('tf_trust_score', trustScore);
    c.set('tf_device_id', deviceId);

    if (Math.abs(trustScore - previousScore) > 10) {
      await logEvent(options, c, userId, sessionId, 'TRUST_SCORE_CHANGE', { trustScore, previousScore, delta: trustScore - previousScore });
    }

    await next();
  };
}

// ─── Helpers ───

async function logEvent(
  options: TokenForgeServerOptions, c: Context,
  userId: string, sessionId: string,
  eventType: SecurityEventType, metadata: Record<string, unknown>,
): Promise<void> {
  const event: SecurityEvent & { id: string } = {
    id: crypto.randomUUID(),
    sessionId, userId, eventType, trustScoreBefore: 0, trustScoreAfter: 0,
    ipAddress: options.getIpAddress?.(c.req.raw) ?? c.req.header('cf-connecting-ip') ?? '',
    countryCode: options.getCountryCode?.(c.req.raw) ?? c.req.header('cf-ipcountry') ?? '',
    userAgent: options.getUserAgent?.(c.req.raw) ?? c.req.header('user-agent') ?? '',
    metadata,
  };
  options.onSecurityEvent?.(event).catch(console.error);
  await options.storage.logEvent(event).catch(console.error);
}

/**
 * Check whether a request path matches any skip pattern.
 * @param path - The incoming request path.
 * @param skipPaths - Glob-style patterns (trailing `*` supported).
 * @returns True if the path should bypass verification.
 */
export function shouldSkip(path: string, skipPaths?: string[]): boolean {
  if (!skipPaths) return false;
  return skipPaths.some((pattern) => {
    if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
    return path === pattern;
  });
}

/**
 * Check whether a request matches a sensitive operation pattern.
 * @param path - The incoming request path.
 * @param method - HTTP method (GET, POST, etc.).
 * @param sensitiveOps - Patterns like "DELETE /api/agents/*".
 * @returns True if the request is a sensitive operation requiring elevated trust.
 */
export function isSensitiveOp(path: string, method: string, sensitiveOps?: string[]): boolean {
  if (!sensitiveOps) return false;
  const key = `${method} ${path}`;
  return sensitiveOps.some((op) => {
    if (op.includes('*')) {
      const parts = op.split(' ');
      const opMethod = parts[0];
      const opPath = parts[1];
      if (opMethod !== method || !opPath) return false;
      return new RegExp('^' + opPath.replace(/\*/g, '[^/]+') + '$').test(path);
    }
    return key === op;
  });
}
