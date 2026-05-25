/**
 * Workforce SSO callback — POST /v1/workforce/sso/:appId/exchange.
 *
 * Customer's backend posts an IdP-issued OIDC ID token here after the
 * IdP login redirect completes. Body: { idToken: "<jwt>" }. We verify
 * the token against the workforce app's JWKS, upsert the subject, and
 * return a register-purpose DBSC challenge the browser SDK then signs
 * to bind a device.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { tfWorkforceApps } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { makeChallengeStore } from '../services/dbsc/challenge-store.js';
import { getJwks } from '../services/workforce/jwks-cache.js';
import { exchangeSso } from '../services/workforce/sso-exchange.js';

const exchangeSchema = z.object({
  idToken: z.string().min(20).max(8192),
});

export const workforceSsoRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

workforceSsoRoutes.post('/:appId/exchange', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const appId = c.req.param('appId');

  const body = await c.req.json().catch(() => null);
  const parsed = exchangeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const [app] = await db
    .select()
    .from(tfWorkforceApps)
    .where(and(
      eq(tfWorkforceApps.id, appId),
      eq(tfWorkforceApps.tenantId, tenantId),
    ))
    .limit(1);
  if (!app) return c.json({ error: 'workforce_app_not_found' }, 404);

  const jwks = await getJwks(c.env.CACHE, app.jwksUri);
  if (!jwks) return c.json({ error: 'jwks_unavailable' }, 503);

  const result = await exchangeSso(db, makeChallengeStore(db), {
    tenantId,
    workforceAppId: appId,
    idToken: parsed.data.idToken,
    jwks,
  });

  if (!result.ok) {
    return c.json({ error: result.reason }, 401);
  }

  return c.json({
    data: {
      subjectId: result.subjectId,
      externalSubject: result.externalSubject,
      email: result.email,
      challenge: result.challenge,
      challengeExpiresAt: result.challengeExpiresAt,
      registerUrl: '/v1/dbsc/register',
    },
  });
});
