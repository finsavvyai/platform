import { Hono } from 'hono';
import { hashFingerprint } from './trust-score.js';
import { issueBoundCookie, setBoundCookieHeader } from './bound-cookie.js';
import type { TokenForgeServerOptions, DeviceSession } from '../shared/types.js';

interface Variables {
  userId: string;
  sessionId: string;
}

/**
 * TokenForge binding and session management routes.
 * Mount at /api/tf on the main Hono app.
 * @param options - Server options (storage, thresholds, callbacks).
 * @returns A Hono sub-app with /bind, /sessions, /events, /trust-score routes.
 */
export function createTokenForgeRoutes(options: TokenForgeServerOptions): Hono<{ Variables: Variables }> {
  const tf = new Hono<{ Variables: Variables }>();

  tf.post('/bind', async (c) => {
    const userId = c.get('userId');
    const sessionId = c.get('sessionId');
    if (!userId || !sessionId) return c.json({ error: 'unauthorized' }, 401);

    const body = await c.req.json<{
      publicKey: JsonWebKey;
      sessionId: string;
      metadata: Record<string, string>;
    }>();

    if (body.sessionId !== sessionId) return c.json({ error: 'session_mismatch' }, 400);
    if (!body.publicKey?.kty || body.publicKey.kty !== 'EC' || body.publicKey.crv !== 'P-256') {
      return c.json({ error: 'invalid_key_format' }, 400);
    }

    const deviceId = crypto.randomUUID().replace(/-/g, '');
    const fingerprint = hashFingerprint(body.metadata?.userAgent || '');
    const expiresAt = new Date(Date.now() + options.sessionMaxAge * 1000).toISOString();
    const ipAddress = options.getIpAddress?.(c.req.raw) ?? c.req.header('cf-connecting-ip') ?? '';
    const countryCode = options.getCountryCode?.(c.req.raw) ?? c.req.header('cf-ipcountry') ?? '';

    await options.storage.revokeUserSessions(userId);

    const session: DeviceSession = {
      id: deviceId, session_id: sessionId, user_id: userId,
      public_key: JSON.stringify(body.publicKey),
      device_fingerprint: fingerprint, ip_address: ipAddress,
      country_code: countryCode, trust_score: 100,
      bound_at: new Date().toISOString(), last_verified_at: new Date().toISOString(),
      expires_at: expiresAt, revoked: 0, revoked_reason: null,
      created_at: new Date().toISOString(),
    };
    await options.storage.createSession(session);

    await options.storage.logEvent({
      id: crypto.randomUUID(), sessionId, userId,
      eventType: 'DEVICE_BOUND', trustScoreBefore: 0, trustScoreAfter: 100,
      ipAddress, countryCode,
      userAgent: options.getUserAgent?.(c.req.raw) ?? c.req.header('user-agent') ?? '',
      metadata: { deviceId, fingerprint, metadata: body.metadata },
    });

    // Issue DBSC bound cookie if enabled
    if (options.dbsc?.enabled) {
      const rotationInterval = options.dbsc.rotationInterval ?? 300;
      const cookie = await issueBoundCookie({ maxAgeSeconds: rotationInterval });
      await options.storage.updateBoundCookieHash(deviceId, cookie.hash, cookie.expiresAt);
      c.header('Set-Cookie', setBoundCookieHeader(cookie));
    }

    return c.json({ deviceId, expiresAt });
  });

  tf.get('/sessions', async (c) => {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'unauthorized' }, 401);
    const sessions = await options.storage.listUserSessions(userId, 20);
    return c.json({ sessions });
  });

  tf.delete('/sessions/:id', async (c) => {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'unauthorized' }, 401);
    await options.storage.revokeSession(c.req.param('id'), 'user_revoked');
    return c.json({ revoked: true });
  });

  tf.get('/events', async (c) => {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'unauthorized' }, 401);
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const events = await options.storage.listEvents(userId, limit, offset);
    return c.json({ events });
  });

  tf.get('/trust-score', async (c) => {
    const userId = c.get('userId');
    const sessionId = c.get('sessionId');
    const deviceId = c.req.header('X-TF-Device-ID');
    if (!userId) return c.json({ error: 'unauthorized' }, 401);
    if (!deviceId || !sessionId) return c.json({ trustScore: 0, isBound: false, deviceId: null });

    const session = await options.storage.getSession(sessionId, deviceId);
    if (!session) return c.json({ trustScore: 0, isBound: false, deviceId: null });

    return c.json({ trustScore: session.trust_score, isBound: true, deviceId });
  });

  return tf;
}

/** @deprecated Use createTokenForgeRoutes(options) instead */
export const tokenForgeRoutes = new Hono();
