/**
 * POST /v1/sessions/dbsc-register
 *
 * Native DBSC ingress. The browser delivered a single compact JWS
 * (Content-Type: application/jwt) carrying its hardware-bound public
 * key + the challenge we issued. We verify, bind the session, and
 * emit a W3C-shape registration response.
 *
 * The `subject` and `app_id` arrive separately because native DBSC's
 * JWT spec doesn't carry product-specific claims — the customer's
 * backend pre-issued the challenge with those fields attached.
 */

import { z } from 'zod';
import type { Context } from 'hono';
import {
  consumeChallenge,
  issueBoundCookie,
  verifyDbscRegistrationJwt,
  type ChallengeStore,
} from '@tokenforge/protocol';
import type { DbAccess } from '../lib/db-access.js';
import { newAuditId, newSessionId, newSubjectId } from '../lib/ids.js';
import type { App } from '@tokenforge/db';

const querySchema = z.object({
  app_id: z.string().min(4),
  subject: z.string().min(1),
});

export type DbscRegisterDeps = {
  db: DbAccess;
  challengeStore: ChallengeStore;
  /** Public registration URL (used as JWS audience). */
  registrationUrl: string;
  refreshUrl: string;
};

export async function handleDbscRegister(
  c: Context,
  deps: DbscRegisterDeps,
): Promise<Response> {
  const ct = c.req.header('Content-Type') ?? '';
  if (!ct.startsWith('application/jwt')) {
    return c.json({ error: 'expected_application_jwt' }, 415);
  }
  const jws = (await c.req.text()).trim();
  if (!jws) return c.json({ error: 'missing_jws' }, 400);

  const parsed = querySchema.safeParse({
    app_id: c.req.query('app_id'),
    subject: c.req.query('subject'),
  });
  if (!parsed.success) return c.json({ error: 'missing_app_or_subject' }, 400);
  const { app_id, subject } = parsed.data;

  const app = c.get('app') as App;
  if (app_id !== app.id) return c.json({ error: 'app_id_mismatch' }, 403);

  // Peek the challenge (jti) from the JWS payload to address the right row.
  const payloadB64 = jws.split('.')[1] ?? '';
  let jti = '';
  try {
    const json = JSON.parse(b64UrlDecode(payloadB64)) as { jti?: string };
    jti = json.jti ?? '';
  } catch {
    return c.json({ error: 'jws_malformed' }, 400);
  }
  if (!jti) return c.json({ error: 'missing_jti' }, 400);

  const verify = await verifyDbscRegistrationJwt(jws, {
    expectedAud: deps.registrationUrl,
    expectedJti: jti,
  });
  if (!verify.ok) return c.json({ error: verify.reason }, 401);

  const consumed = await consumeChallenge(deps.challengeStore, jti, {
    tenantId: app.tenantId,
    purpose: 'register',
  });
  if (!consumed.ok) return c.json({ error: consumed.reason }, 401);

  const now = new Date();
  let subj = await deps.db.findSubject(app.id, subject);
  if (!subj) {
    subj = await deps.db.insertSubject({
      id: newSubjectId(),
      appId: app.id,
      externalSubject: subject,
      firstSeenAt: now,
      lastSeenAt: now,
    });
  } else {
    await deps.db.touchSubject(subj.id, now);
  }

  const sessionId = newSessionId();
  const short = await issueBoundCookie({ maxAgeSeconds: app.shortCookieTtlSec });
  const expiresAt = new Date(now.getTime() + app.longCookieTtlSec * 1000);
  await deps.db.insertSession({
    id: sessionId,
    appId: app.id,
    subjectId: subj.id,
    publicKeyJwk: verify.jwk,
    bindingClass: 'native_dbsc',
    origin: app.origin,
    userAgent: c.req.header('User-Agent') ?? null,
    ipFirst: c.req.header('CF-Connecting-IP') ?? null,
    geoFirst: c.req.header('CF-IPCountry') ?? null,
    boundCookieHash: short.hash,
    boundCookieIssuedAt: new Date(short.issuedAt),
    boundCookieExpiresAt: new Date(short.expiresAt),
    createdAt: now,
    expiresAt,
  });

  await deps.db.insertAudit({
    id: newAuditId(),
    appId: app.id,
    sessionId,
    type: 'register',
    severity: 'info',
    payload: { binding_class: 'native_dbsc', subject },
    at: now,
  });

  c.header(
    'Set-Cookie',
    `tf_bound=${short.value}; Max-Age=${short.maxAgeSeconds}; Secure;HttpOnly;SameSite=Lax;Path=/`,
  );

  return c.json({
    session_identifier: sessionId,
    refresh_url: deps.refreshUrl,
    scope: { origin: app.origin, include_site: true },
    credentials: [
      {
        type: 'cookie',
        name: 'tf_bound',
        attributes: 'Secure;HttpOnly;SameSite=Lax;Path=/',
      },
    ],
  });
}

function b64UrlDecode(b64: string): string {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  return atob(padded);
}
