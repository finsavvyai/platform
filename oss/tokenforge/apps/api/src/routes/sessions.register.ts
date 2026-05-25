/**
 * POST /v1/sessions/register
 *
 * Server-to-server. The customer's backend calls this AFTER its own
 * login finishes. We bind the supplied public key to a fresh session,
 * issue first-party cookies the backend then sets on its response,
 * and return a refresh URL + initial challenge.
 */

import { z } from 'zod';
import type { Context } from 'hono';
import {
  issueBoundCookie,
  issueChallenge,
  type ChallengeStore,
} from '@tokenforge/protocol';
import type { DbAccess } from '../lib/db-access.js';
import { newAuditId, newSessionId, newSubjectId } from '../lib/ids.js';
import { longCookieDescriptor, shortCookieDescriptor } from '../lib/cookies.js';
import type { App } from '@tokenforge/db';

export const registerSchema = z.object({
  app_id: z.string().min(4),
  subject: z.string().min(1).max(256),
  subject_metadata: z.record(z.unknown()).optional(),
  public_key_jwk: z.object({
    kty: z.literal('EC'),
    crv: z.literal('P-256'),
    x: z.string().min(1),
    y: z.string().min(1),
  }).passthrough(),
  binding_class: z.enum(['native_dbsc', 'webauthn', 'webcrypto']),
  attestation: z.string().optional(),
  client_ip: z.string().optional(),
  user_agent: z.string().optional(),
});

export type RegisterDeps = {
  db: DbAccess;
  challengeStore: ChallengeStore;
  refreshUrl: string;
};

export async function handleRegister(
  c: Context,
  deps: RegisterDeps,
): Promise<Response> {
  const json = await safeJson(c);
  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const app = c.get('app') as App;
  if (body.app_id !== app.id) return c.json({ error: 'app_id_mismatch' }, 403);

  const now = new Date();
  let subject = await deps.db.findSubject(app.id, body.subject);
  if (!subject) {
    subject = await deps.db.insertSubject({
      id: newSubjectId(),
      appId: app.id,
      externalSubject: body.subject,
      metadata: body.subject_metadata ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
    });
  } else {
    await deps.db.touchSubject(subject.id, now);
  }

  const sessionId = newSessionId();
  const short = await issueBoundCookie({ maxAgeSeconds: app.shortCookieTtlSec });
  const long = await issueBoundCookie({ maxAgeSeconds: app.longCookieTtlSec });
  const expiresAt = new Date(now.getTime() + app.longCookieTtlSec * 1000);
  await deps.db.insertSession({
    id: sessionId,
    appId: app.id,
    subjectId: subject.id,
    publicKeyJwk: body.public_key_jwk,
    bindingClass: body.binding_class,
    origin: app.origin,
    userAgent: body.user_agent ?? null,
    ipFirst: body.client_ip ?? null,
    boundCookieHash: short.hash,
    boundCookieIssuedAt: new Date(short.issuedAt),
    boundCookieExpiresAt: new Date(short.expiresAt),
    longCookieHash: long.hash,
    longCookieExpiresAt: new Date(long.expiresAt),
    createdAt: now,
    expiresAt,
  });

  const issued = await issueChallenge(deps.challengeStore, {
    tenantId: app.tenantId,
    purpose: 'refresh',
    sessionId,
  });

  await deps.db.insertAudit({
    id: newAuditId(),
    appId: app.id,
    sessionId,
    type: 'register',
    severity: 'info',
    ip: body.client_ip ?? null,
    ua: body.user_agent ?? null,
    payload: { binding_class: body.binding_class, subject: body.subject },
    at: now,
  });

  return c.json({
    session_id: sessionId,
    short_cookie: shortCookieDescriptor(short.value, short.maxAgeSeconds),
    long_cookie: longCookieDescriptor(long.value, long.maxAgeSeconds),
    refresh_url: deps.refreshUrl,
    challenge: issued.challenge,
  });
}

async function safeJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
