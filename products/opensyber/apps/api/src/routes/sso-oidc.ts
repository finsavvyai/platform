import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { ssoConfigs, organizations, users, orgMembers } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Role } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { generateSsoToken } from '../lib/sso-token.js';
import {
  discoverEndpoints, generateCodeVerifier, generateCodeChallenge,
  buildAuthUrl, exchangeCode, fetchUserInfo,
} from '../services/oidc.js';
import { decrypt } from '../utils/encryption.js';

const ssoOidcRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

ssoOidcRoutes.use('*', dbMiddleware);

// GET /api/sso/:orgSlug/oidc/login — redirect to IdP with PKCE
ssoOidcRoutes.get('/:orgSlug/oidc/login', async (c) => {
  const orgSlug = c.req.param('orgSlug');
  const db = c.get('db');

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1);
  if (!org) return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);

  const [config] = await db.select().from(ssoConfigs)
    .where(and(eq(ssoConfigs.orgId, org.id), eq(ssoConfigs.isActive, 1))).limit(1);
  if (!config || config.provider !== 'oidc' || !config.oidcIssuer || !config.oidcClientId) {
    return c.json({ error: 'Not Found', message: 'OIDC SSO not configured' }, 404);
  }

  const endpoints = await discoverEndpoints(config.oidcIssuer);
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store state + verifier in KV with 5min TTL
  await c.env.CACHE.put(
    `sso:state:${state}`,
    JSON.stringify({ orgId: org.id, orgSlug, codeVerifier, configId: config.id }),
    { expirationTtl: 300 },
  );

  const redirectUri = `https://opensyber.cloud/api/sso/${orgSlug}/oidc/callback`;
  const authUrl = buildAuthUrl(
    endpoints.authorizationEndpoint,
    config.oidcClientId,
    redirectUri,
    state,
    codeChallenge,
  );

  return c.redirect(authUrl);
});

// GET /api/sso/:orgSlug/oidc/callback — exchange code and provision user
ssoOidcRoutes.get('/:orgSlug/oidc/callback', async (c) => {
  const orgSlug = c.req.param('orgSlug');
  const code = c.req.query('code');
  const state = c.req.query('state');
  const db = c.get('db');

  if (!code || !state) return c.json({ error: 'Bad Request', message: 'Missing code or state' }, 400);

  // Validate state from KV
  const stateData = await c.env.CACHE.get(`sso:state:${state}`);
  if (!stateData) return c.json({ error: 'Bad Request', message: 'Invalid or expired state' }, 400);

  await c.env.CACHE.delete(`sso:state:${state}`); // Consume state (prevent replay)
  const { orgId, codeVerifier, configId } = JSON.parse(stateData);

  const [config] = await db.select().from(ssoConfigs).where(eq(ssoConfigs.id, configId)).limit(1);
  if (!config || !config.oidcIssuer || !config.oidcClientId) {
    return c.json({ error: 'Not Found', message: 'SSO config not found' }, 404);
  }

  const endpoints = await discoverEndpoints(config.oidcIssuer);
  const redirectUri = `https://opensyber.cloud/api/sso/${orgSlug}/oidc/callback`;

  const tokens = await exchangeCode(
    endpoints.tokenEndpoint,
    config.oidcClientId,
    config.oidcClientSecretEncrypted
      ? await decrypt(config.oidcClientSecretEncrypted, c.env.ENCRYPTION_KEY)
      : '',
    redirectUri,
    code,
    codeVerifier,
  );

  const userInfo = await fetchUserInfo(tokens.accessToken, endpoints.userinfoEndpoint);
  if (!userInfo.email) return c.json({ error: 'Unauthorized', message: 'No email from IdP' }, 401);

  // Provision or find user
  const [existingUser] = await db.select().from(users).where(eq(users.email, userInfo.email)).limit(1);
  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else if (config.autoProvision) {
    userId = generateId();
    const now = new Date().toISOString();
    await db.insert(users).values({
      id: userId, email: userInfo.email, name: userInfo.name, createdAt: now, updatedAt: now,
    });
  } else {
    return c.json({ error: 'Forbidden', message: 'User not provisioned' }, 403);
  }

  // Ensure org membership
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const [membership] = await db.select().from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId))).limit(1);

  if (!membership && org) {
    const now = new Date().toISOString();
    await db.insert(orgMembers).values({
      id: generateId(), orgId, userId, role: config.defaultRole as Role,
      invitedBy: org.ownerId, invitedAt: now, acceptedAt: now, status: 'active',
    });
  }

  // Generate session token and store behind a single-use code
  const token = await generateSsoToken(userId, c.env.AUTH_SECRET);
  const ssoCode = crypto.randomUUID();
  await c.env.CACHE.put(`sso:code:${ssoCode}`, token, { expirationTtl: 120 });
  // Redirect with code instead of token
  return c.redirect(`https://opensyber.cloud/dashboard?sso=success&org=${orgSlug}&code=${ssoCode}`);
});

export { ssoOidcRoutes };
