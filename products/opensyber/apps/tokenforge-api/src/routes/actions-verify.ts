/**
 * Action verification endpoint — POST /v1/actions/verify (Sprint 39).
 *
 * Server-side counterpart to `tokenforge.signAction()` on the client.
 * Customer's backend posts an action JWS plus the asserted action verb;
 * the route looks up the bound DBSC session, optionally pulls the TLS
 * exporter material from `X-TF-Channel-Exporter`, and runs the JWS
 * through `verifyAction` (claims.action match + claims.actionHash match
 * if body supplied + tls-exporter binding when available).
 *
 * Replay across the same body in the freshness window is the caller's
 * responsibility — they should `consumeChallenge(claims.nonce)` after
 * a successful verdict to one-shot the JWS.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { tfDbscSessions } from '@opensyber/db';
import { verifyAction } from '@opensyber/tokenforge/server/internal';
import type { Env, Variables } from '../types.js';
import { readTlsExporter } from '../services/edge/tls-exporter.js';

const verifySchema = z.object({
  // Sprint 37 line 113: privileged route returns 401 (not 400) when
  // bound cookie is present but JWS is missing. Schema must let the
  // session lookup run BEFORE rejecting on a missing JWS, so jws is
  // optional here and the missing-but-bound case is caught downstream.
  jws: z.string().min(40).max(8192).optional(),
  sessionId: z.string().min(1).max(128),
  expectedAction: z.string().min(1).max(120),
  body: z.record(z.string(), z.unknown()).optional(),
  requireTlsExporter: z.boolean().optional(),
  maxAgeSeconds: z.number().int().min(15).max(300).optional(),
});

export const actionsVerifyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

actionsVerifyRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const parsed = verifySchema.safeParse(await c.req.json().catch(() => ({})));
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
  if (new Date(session.boundCookieExpiresAt) < new Date()) {
    return c.json({ error: 'session_expired' }, 401);
  }

  // Sprint 37 line 113: bound cookie is present (session lookup OK + not
  // revoked + not expired). JWS missing → 401 jws_required. Stale JWS is
  // caught by verifyAction below as `jws_too_old` (also 401 per line 73).
  if (!parsed.data.jws) {
    return c.json({ error: 'jws_required' }, 401);
  }

  const { exporter, channelBoundHeader } = readTlsExporter((n) => c.req.header(n));
  c.header('Sec-TF-Channel-Bound', channelBoundHeader);

  const maxAge = parsed.data.maxAgeSeconds ?? 60;
  const result = await verifyAction(parsed.data.jws, {
    publicKey: session.publicKey,
    expectedAction: parsed.data.expectedAction,
    body: parsed.data.body ?? null,
    expectedTlsExporter: exporter ?? undefined,
    requireTlsExporter: parsed.data.requireTlsExporter ?? false,
    maxAgeSeconds: maxAge,
  });

  if (!result.ok) {
    return c.json({ error: result.reason }, 401);
  }

  // One-shot the JWS nonce so a second post of the same JWS within the
  // freshness window is rejected even though the signature still validates.
  const nonceKey = `action_nonce:${tenantId}:${result.claims.nonce}`;
  if (await c.env.CACHE.get(nonceKey)) {
    return c.json({ error: 'nonce_replay' }, 401);
  }
  c.executionCtx.waitUntil(c.env.CACHE.put(nonceKey, '1', { expirationTtl: maxAge + 5 }));

  return c.json({
    data: {
      verified: true,
      action: result.claims.action,
      sub: result.claims.sub,
      nonce: result.claims.nonce,
      iat: result.claims.iat,
      exp: result.claims.exp,
      channelBound: channelBoundHeader === '1',
    },
  });
});
