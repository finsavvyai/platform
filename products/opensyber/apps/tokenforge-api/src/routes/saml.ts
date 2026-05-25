/**
 * SAML routes:
 *   GET  /v1/saml/metadata/:tenantId   SP metadata XML for IdP config
 *   POST /v1/saml/acs/:tenantId        Assertion Consumer Service
 *
 * ACS receives the IdP's POST-binding SAML Response, parses it,
 * validates conditions, upserts the subject, and returns a DBSC
 * register-purpose challenge — same flow as OIDC SSO exchange.
 */

import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { tfSubjects, tfWorkforceApps } from '@opensyber/db';
import { issueChallenge } from '@opensyber/tokenforge/server/internal';
import type { Env, Variables } from '../types.js';
import { generateSpMetadata } from '../services/saml/metadata.js';
import { decodeSamlResponse, parseSamlResponse } from '../services/saml/assertion-parser.js';
import { makeChallengeStore } from '../services/dbsc/challenge-store.js';

export const samlRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/** SP metadata — public, no auth needed */
samlRoutes.get('/metadata/:tenantId', (c) => {
  const xml = generateSpMetadata(c.req.param('tenantId'));
  return c.body(xml, 200, { 'Content-Type': 'application/samlmetadata+xml' });
});

/** ACS — receives SAML Response via HTTP-POST binding */
samlRoutes.post('/acs/:tenantId', async (c) => {
  const db = c.get('db');
  const tenantId = c.req.param('tenantId');

  const formData = await c.req.parseBody().catch(() => ({} as Record<string, string | File>));
  const samlResponseB64 = (formData as Record<string, string | File>)['SAMLResponse'];
  if (typeof samlResponseB64 !== 'string') {
    return c.json({ error: 'missing_saml_response' }, 400);
  }

  const xml = decodeSamlResponse(samlResponseB64);
  if (!xml) return c.json({ error: 'invalid_saml_encoding' }, 400);

  const assertion = parseSamlResponse(xml);
  if (!assertion || !assertion.nameId) {
    return c.json({ error: 'saml_parse_failed' }, 400);
  }

  if (assertion.notOnOrAfter) {
    const expires = new Date(assertion.notOnOrAfter);
    if (expires < new Date()) {
      return c.json({ error: 'saml_assertion_expired' }, 401);
    }
  }

  const [app] = await db
    .select()
    .from(tfWorkforceApps)
    .where(and(
      eq(tfWorkforceApps.tenantId, tenantId),
      eq(tfWorkforceApps.issuer, assertion.issuer),
    ))
    .limit(1);
  if (!app) return c.json({ error: 'unknown_saml_issuer' }, 401);
  if (!app.enabled) return c.json({ error: 'workforce_app_disabled' }, 401);

  const now = new Date().toISOString();
  const email = assertion.nameId.includes('@') ? assertion.nameId : null;
  const displayName = assertion.attributes['displayName']
    ?? assertion.attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
    ?? null;

  const [existing] = await db
    .select()
    .from(tfSubjects)
    .where(and(
      eq(tfSubjects.workforceAppId, app.id),
      eq(tfSubjects.externalSubject, assertion.nameId),
    ))
    .limit(1);

  let subjectId: string;
  if (existing) {
    subjectId = existing.id;
    await db
      .update(tfSubjects)
      .set({ email, name: displayName, lastSeenAt: now })
      .where(eq(tfSubjects.id, existing.id));
  } else {
    subjectId = `tf-sub-${crypto.randomUUID()}`;
    await db.insert(tfSubjects).values({
      id: subjectId,
      tenantId,
      workforceAppId: app.id,
      externalSubject: assertion.nameId,
      email,
      name: displayName,
      metadata: JSON.stringify({ samlAttributes: assertion.attributes }),
      firstSeenAt: now,
      lastSeenAt: now,
    });
  }

  const { challenge, record } = await issueChallenge(makeChallengeStore(db), {
    tenantId,
    purpose: 'register',
    ttlSeconds: 120,
  });

  return c.json({
    data: {
      subjectId,
      nameId: assertion.nameId,
      email,
      challenge,
      challengeExpiresAt: record.expiresAt,
      registerUrl: '/v1/dbsc/register',
    },
  });
});
