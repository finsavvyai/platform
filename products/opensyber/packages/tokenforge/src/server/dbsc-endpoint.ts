/**
 * DBSC challenge endpoint — issues and consumes DBSC challenges.
 * Mount at /api/tf/dbsc on the main Hono app alongside the binding routes.
 */

import { Hono } from 'hono';
import { issueChallenge, consumeChallenge, type ChallengeStore } from './dbsc-challenge.js';
import { issueBoundCookie, setBoundCookieHeader } from './bound-cookie.js';
import type { TokenForgeServerOptions } from '../shared/types.js';

interface Variables {
  userId: string;
  sessionId: string;
}

/**
 * Adapter that bridges TokenForgeStorageRef to the ChallengeStore interface
 * expected by the dbsc-challenge module.
 */
function makeChallengeStore(options: TokenForgeServerOptions): ChallengeStore {
  return {
    async put(record) {
      await options.storage.createChallenge(record);
    },
    async takeIfFresh(hash, now) {
      // Use storage.getChallenge with hash as the ID lookup key.
      // The memory storage and D1 storage both support this pattern.
      const record = await options.storage.getChallenge(hash, '');
      if (!record) return null;
      const typed = record as { expiresAt: string; consumed: boolean };
      if (new Date(typed.expiresAt) < now) return null;
      return record as Awaited<ReturnType<ChallengeStore['takeIfFresh']>>;
    },
  };
}

/**
 * Create DBSC challenge routes.
 * @param options - Server options (storage, DBSC config).
 * @returns A Hono sub-app with /challenge (POST) and /verify (POST) routes.
 */
export function createDbscRoutes(options: TokenForgeServerOptions): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();
  const store = makeChallengeStore(options);

  /** POST /challenge — issue a new DBSC challenge for the client to sign. */
  app.post('/challenge', async (c) => {
    const userId = c.get('userId');
    const sessionId = c.get('sessionId');
    if (!userId || !sessionId) return c.json({ error: 'unauthorized' }, 401);

    const body = await c.req.json<{ purpose?: 'register' | 'refresh' | 'step_up' }>().catch(() => ({} as { purpose?: 'register' | 'refresh' | 'step_up' }));
    const purpose = body.purpose ?? 'refresh';

    const result = await issueChallenge(store, {
      tenantId: userId,
      purpose,
      sessionId,
    });

    return c.json({
      challenge: result.challenge,
      expiresAt: result.record.expiresAt,
    });
  });

  /** POST /verify — consume a signed challenge and rotate the bound cookie. */
  app.post('/verify', async (c) => {
    const userId = c.get('userId');
    const sessionId = c.get('sessionId');
    if (!userId || !sessionId) return c.json({ error: 'unauthorized' }, 401);

    const body = await c.req.json<{ challenge: string; purpose?: 'register' | 'refresh' | 'step_up' }>();
    if (!body.challenge) return c.json({ error: 'missing_challenge' }, 400);

    const purpose = body.purpose ?? 'refresh';
    const result = await consumeChallenge(store, body.challenge, {
      tenantId: userId,
      purpose,
      sessionId,
    });

    if (!result.ok) return c.json({ error: result.reason }, 400);

    // On successful verification, rotate the bound cookie
    const deviceId = c.req.header('X-TF-Device-ID');
    if (deviceId && options.dbsc?.enabled) {
      const rotationInterval = options.dbsc.rotationInterval ?? 300;
      const cookie = await issueBoundCookie({ maxAgeSeconds: rotationInterval });
      await options.storage.updateBoundCookieHash(deviceId, cookie.hash, cookie.expiresAt);
      c.header('Set-Cookie', setBoundCookieHeader(cookie));
    }

    return c.json({ verified: true });
  });

  return app;
}
