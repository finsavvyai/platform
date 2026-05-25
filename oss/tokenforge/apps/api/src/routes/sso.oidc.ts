/**
 * Workforce-mode OIDC SSO callback.
 *
 * Flow per CISCO-dua.md §1 anti-positioning ("wrap, don't replace"):
 *   1. Customer's backend runs the OAuth redirect dance with their IdP
 *      using their existing OIDC library.
 *   2. Customer POSTs the resulting `id_token` + the bound public key
 *      from the browser SDK to this endpoint.
 *   3. We fetch the IdP's discovery doc + JWKS (cached upstream),
 *      verify the `id_token`, then bind the session under the IdP's
 *      `sub` claim.
 *
 * That keeps OIDC client logic in the customer's stack and preserves
 * TokenForge's lane: session security primitive, not IdP.
 */

import { z } from 'zod';
import type { Context } from 'hono';
import {
  fetchDiscovery,
  fetchJwks,
  issueBoundCookie,
  verifyIdToken,
  type ChallengeStore,
  type JwksKey,
} from '@tokenforge/protocol';
import type { App } from '@tokenforge/db';
import type { DbAccess } from '../lib/db-access.js';
import { newAuditId, newSessionId, newSubjectId } from '../lib/ids.js';
import { longCookieDescriptor, shortCookieDescriptor } from '../lib/cookies.js';

const bodySchema = z.object({
  id_token: z.string().min(8),
  public_key_jwk: z.object({
    kty: z.literal('EC'),
    crv: z.literal('P-256'),
    x: z.string().min(1),
    y: z.string().min(1),
  }).passthrough(),
  binding_class: z.enum(['webauthn', 'webcrypto']).default('webcrypto'),
  expected_nonce: z.string().optional(),
});

export interface OidcSsoDeps {
  db: DbAccess;
  challengeStore: ChallengeStore;
  refreshUrl: string;
  fetchImpl?: typeof globalThis.fetch;
}

interface IdpConfig {
  issuer: string;
  audience: string;
}

export async function handleOidcCallback(c: Context, deps: OidcSsoDeps): Promise<Response> {
  const app = c.get('app') as App;
  if (app.mode !== 'workforce') return c.json({ error: 'app_not_workforce' }, 400);
  const idp = parseIdpConfig(app.idpConfig as unknown);
  if (!idp) return c.json({ error: 'idp_not_configured' }, 400);

  const body = bodySchema.safeParse(await safeJson(c));
  if (!body.success) return c.json({ error: 'invalid_body', issues: body.error.flatten() }, 400);

  let discovery;
  let jwks;
  try {
    discovery = await fetchDiscovery(idp.issuer, { fetchImpl: deps.fetchImpl });
    jwks = await fetchJwks(discovery.jwks_uri, { fetchImpl: deps.fetchImpl });
  } catch (e) {
    return c.json({ error: 'idp_discovery_failed', detail: (e as Error).message }, 502);
  }

  const verify = await verifyIdToken(body.data.id_token, {
    jwks: { keys: jwks.keys as JwksKey[] },
    expectedIssuer: idp.issuer,
    expectedAudience: idp.audience,
    expectedNonce: body.data.expected_nonce,
  });
  if (!verify.ok) {
    await deps.db.insertAudit({
      id: newAuditId(),
      appId: app.id,
      type: 'oidc_failed',
      severity: 'warn',
      payload: { reason: verify.reason },
      at: new Date(),
    });
    return c.json({ error: verify.reason }, 401);
  }

  const subject = verify.claims.sub;
  const now = new Date();
  let subjectRow = await deps.db.findSubject(app.id, subject);
  if (!subjectRow) {
    subjectRow = await deps.db.insertSubject({
      id: newSubjectId(),
      appId: app.id,
      externalSubject: subject,
      metadata: { email: verify.claims.email, name: verify.claims.name },
      firstSeenAt: now,
      lastSeenAt: now,
    });
  } else {
    await deps.db.touchSubject(subjectRow.id, now);
  }

  const sessionId = newSessionId();
  const short = await issueBoundCookie({ maxAgeSeconds: app.shortCookieTtlSec });
  const long = await issueBoundCookie({ maxAgeSeconds: app.longCookieTtlSec });
  const expiresAt = new Date(now.getTime() + app.longCookieTtlSec * 1000);
  await deps.db.insertSession({
    id: sessionId,
    appId: app.id,
    subjectId: subjectRow.id,
    publicKeyJwk: body.data.public_key_jwk,
    bindingClass: body.data.binding_class,
    origin: app.origin,
    userAgent: c.req.header('User-Agent') ?? null,
    ipFirst: c.req.header('CF-Connecting-IP') ?? null,
    geoFirst: c.req.header('CF-IPCountry') ?? null,
    boundCookieHash: short.hash,
    boundCookieIssuedAt: new Date(short.issuedAt),
    boundCookieExpiresAt: new Date(short.expiresAt),
    longCookieHash: long.hash,
    longCookieExpiresAt: new Date(long.expiresAt),
    createdAt: now,
    expiresAt,
  });

  await deps.db.insertAudit({
    id: newAuditId(),
    appId: app.id,
    sessionId,
    type: 'oidc_register',
    severity: 'info',
    payload: { idp_iss: idp.issuer, subject },
    at: now,
  });

  return c.json({
    session_id: sessionId,
    short_cookie: shortCookieDescriptor(short.value, short.maxAgeSeconds),
    long_cookie: longCookieDescriptor(long.value, long.maxAgeSeconds),
    refresh_url: deps.refreshUrl,
    subject_email: verify.claims.email ?? null,
  });
}

function parseIdpConfig(value: unknown): IdpConfig | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.issuer !== 'string' || typeof v.audience !== 'string') return null;
  return { issuer: v.issuer, audience: v.audience };
}

async function safeJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
