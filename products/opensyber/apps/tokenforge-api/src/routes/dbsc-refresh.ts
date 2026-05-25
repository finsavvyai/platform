/**
 * DBSC refresh endpoint — POST /v1/dbsc/refresh.
 *
 *   1. Client received `Sec-Session-Challenge` on the previous response
 *   2. Client signs JWS over {sub: sessionId, iat, exp, nonce: challenge,
 *                            action?, actionHash?, tlsExporter?}
 *   3. Sends `Sec-Session-Response: <jws>` to this endpoint
 *   4. Server consumes challenge, verifies JWS against the bound public
 *      key, validates the cookie hash matches, computes AitM risk
 *      signals, and (depending on action) rotates the cookie or steps up.
 *
 * Replay protection: every challenge is one-shot. Channel binding: when
 * the runtime exposes RFC 9266 TLS exporter material we mix it in; when
 * it doesn't (workerd) we emit `Sec-TF-Channel-Bound: 0` so callers
 * know the binding is best-effort.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { tfDbscSessions } from '@opensyber/db';
import {
  consumeChallenge,
  issueBoundCookie,
  hashBoundCookie,
  setBoundCookieHeader,
  BOUND_COOKIE_NAME,
  verifyCompactJws,
} from '@opensyber/tokenforge/server/internal';
import type { Env, Variables } from '../types.js';
import { makeChallengeStore } from '../services/dbsc/challenge-store.js';
import {
  computeRefreshAction,
  fireActionWebhooks,
} from '../services/dbsc/refresh-actions.js';
import { readTlsExporter } from '../services/edge/tls-exporter.js';

const refreshSchema = z.object({
  sessionId: z.string().min(1),
  challenge: z.string().min(8),
});

export const dbscRefreshRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

dbscRefreshRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const jws = c.req.header('Sec-Session-Response');
  if (!jws) return c.json({ error: 'missing_session_response' }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const [session] = await db
    .select()
    .from(tfDbscSessions)
    .where(and(
      eq(tfDbscSessions.id, parsed.data.sessionId),
      eq(tfDbscSessions.tenantId, tenantId),
    ))
    .limit(1);
  if (!session) return c.json({ error: 'session_not_found' }, 404);
  if (session.revoked) return c.json({ error: 'session_revoked' }, 401);

  const presentedCookie = readCookie(c.req.header('cookie'), BOUND_COOKIE_NAME);
  if (!presentedCookie) return c.json({ error: 'bound_cookie_missing' }, 401);
  const presentedHash = await hashBoundCookie(presentedCookie);
  if (presentedHash !== session.boundCookieHash) {
    return c.json({ error: 'bound_cookie_mismatch' }, 401);
  }

  const consumed = await consumeChallenge(makeChallengeStore(db), parsed.data.challenge, {
    tenantId, purpose: 'refresh', sessionId: parsed.data.sessionId,
  });
  if (!consumed.ok) return c.json({ error: consumed.reason }, 400);

  const verified = await verifyCompactJws(jws, {
    publicKey: session.publicKey,
    maxAgeSeconds: 60,
  });
  if (!verified.ok) return c.json({ error: verified.reason }, 401);
  if (verified.claims.sub !== parsed.data.sessionId) {
    return c.json({ error: 'jws_subject_mismatch' }, 401);
  }
  if (verified.claims.nonce !== parsed.data.challenge) {
    return c.json({ error: 'jws_nonce_mismatch' }, 401);
  }

  const now = new Date();
  const { action, signals } = await computeRefreshAction({
    db,
    tenantId,
    session: {
      id: session.id,
      deviceId: session.deviceId,
      attestation: session.attestation,
      boundCookieIssuedAt: session.boundCookieIssuedAt,
    },
    geoCountry: c.req.header('cf-ipcountry') ?? null,
    asn: c.req.header('cf-asn') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
    now,
  });

  const webhookCtx = {
    db,
    tenantId,
    sessionId: session.id,
    deviceId: session.deviceId,
    waitUntil: (p: Promise<unknown>) => c.executionCtx.waitUntil(p),
  };

  if (action === 'block' || action === 'revoke_session') {
    const revokedReason = action === 'revoke_session' ? 'policy_revoke' : 'risk_block';
    await db
      .update(tfDbscSessions)
      .set({ revoked: true, revokedReason, updatedAt: now.toISOString() })
      .where(eq(tfDbscSessions.id, session.id));
    fireActionWebhooks(webhookCtx, action, signals, revokedReason);
    return c.json({ data: { action, signals, sessionId: session.id } }, 401);
  }
  if (action === 'step_up') {
    fireActionWebhooks(webhookCtx, action, signals);
    return c.json({ data: { action, signals, sessionId: session.id } });
  }
  fireActionWebhooks(webhookCtx, action, signals);

  const cookie = await issueBoundCookie();
  await db
    .update(tfDbscSessions)
    .set({
      boundCookieHash: cookie.hash,
      boundCookieIssuedAt: cookie.issuedAt,
      boundCookieExpiresAt: cookie.expiresAt,
      updatedAt: now.toISOString(),
    })
    .where(eq(tfDbscSessions.id, parsed.data.sessionId));

  c.header('Set-Cookie', setBoundCookieHeader(cookie));
  const { channelBoundHeader } = readTlsExporter((n) => c.req.header(n));
  c.header('Sec-TF-Channel-Bound', channelBoundHeader);
  return c.json({
    data: {
      action,
      signals,
      sessionId: parsed.data.sessionId,
      maxAgeSeconds: cookie.maxAgeSeconds,
    },
  });
});

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const raw of header.split(';')) {
    const [k, ...rest] = raw.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}
