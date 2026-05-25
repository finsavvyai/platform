/**
 * DBSC registration endpoint — POST /v1/dbsc/register.
 *
 *   1. Client receives `Sec-Session-Registration` header (challenge + path)
 *      from /v1/dbsc/challenge.
 *   2. Client generates an ECDSA P-256 key (browser DBSC native or Web Crypto).
 *   3. Client posts {publicKey, challenge, challengeResponse} here.
 *   4. Server consumes the one-shot challenge, verifies the JWS over the
 *      challenge bytes against the candidate public key, persists the
 *      session row, and returns a freshly issued __Secure-tf-bound cookie.
 *
 * Mirrors the W3C DBSC draft as closely as the Workers runtime allows.
 * TLS exporter binding is best-effort; workerd does not yet expose
 * RFC 9266 material so we emit `Sec-TF-Channel-Bound: 0` when absent.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { tfDbscSessions } from '@opensyber/db';
import {
  consumeChallenge,
  issueBoundCookie,
  setBoundCookieHeader,
  verifyCompactJws,
} from '@opensyber/tokenforge/server/internal';
import type { Env, Variables } from '../types.js';
import { makeChallengeStore } from '../services/dbsc/challenge-store.js';

const registerSchema = z.object({
  alg: z.literal('ES256'),
  publicKey: z.string().min(1),
  challenge: z.string().min(8),
  challengeResponse: z.string().min(20),
  origin: z.string().url().optional(),
  attestation: z.string().optional(),
});

export const dbscRegisterRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

dbscRegisterRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const store = makeChallengeStore(db);
  const consumed = await consumeChallenge(store, parsed.data.challenge, {
    tenantId, purpose: 'register',
  });
  if (!consumed.ok) return c.json({ error: consumed.reason }, 400);

  const verified = await verifyCompactJws(parsed.data.challengeResponse, {
    publicKey: parsed.data.publicKey,
    maxAgeSeconds: 120,
  });
  if (!verified.ok) return c.json({ error: verified.reason }, 401);
  if (verified.claims.nonce !== parsed.data.challenge) {
    return c.json({ error: 'challenge_response_mismatch' }, 401);
  }

  const cookie = await issueBoundCookie();
  const sessionId = `tf-dbsc-${crypto.randomUUID()}`;
  const deviceId = verified.claims.sub || crypto.randomUUID().replace(/-/g, '');
  const origin = (parsed.data.origin ?? c.req.header('origin') ?? '')
    .replace(/\/$/, '')
    .toLowerCase();
  const now = new Date().toISOString();

  // Capture the risk-signal baseline (geo / ASN / UA) at bind time so the
  // refresh endpoint can detect drift. We pack it into `attestation` JSON
  // alongside the optional WebAuthn attestation so we don't need a schema
  // bump. Refresh's `extractField` knows how to read it.
  const baseline = {
    country: c.req.header('cf-ipcountry') ?? null,
    asn: c.req.header('cf-asn') ?? null,
    ua: c.req.header('user-agent') ?? null,
    webauthn: parsed.data.attestation ?? null,
  };

  await db.insert(tfDbscSessions).values({
    id: sessionId,
    tenantId,
    deviceId,
    publicKey: parsed.data.publicKey,
    alg: parsed.data.alg,
    origin,
    boundCookieHash: cookie.hash,
    boundCookieIssuedAt: cookie.issuedAt,
    boundCookieExpiresAt: cookie.expiresAt,
    attestation: JSON.stringify(baseline),
    revoked: false,
    revokedReason: null,
    createdAt: now,
    updatedAt: now,
  });

  c.header('Set-Cookie', setBoundCookieHeader(cookie));
  c.header('Sec-Session-Id', sessionId);
  c.header('Sec-TF-Channel-Bound', '0');
  return c.json(
    {
      data: {
        sessionId,
        deviceId,
        refreshUrl: '/v1/dbsc/refresh',
        maxAgeSeconds: cookie.maxAgeSeconds,
      },
    },
    201,
  );
});
