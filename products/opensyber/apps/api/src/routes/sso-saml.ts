import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { ssoConfigs, organizations, users, orgMembers } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Role } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { generateSsoToken } from '../lib/sso-token.js';
import { buildAuthnRequest, buildSpMetadata, parseSamlResponse, extractAttributes, validateSignature } from '../services/saml.js';

const ssoSamlRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

ssoSamlRoutes.use('*', dbMiddleware);

// GET /api/sso/:orgSlug/saml/metadata — SP metadata XML
ssoSamlRoutes.get('/:orgSlug/saml/metadata', async (c) => {
  const orgSlug = c.req.param('orgSlug');
  const db = c.get('db');

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1);
  if (!org) return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);

  const entityId = `https://opensyber.cloud/sso/${orgSlug}`;
  const acsUrl = `https://opensyber.cloud/api/sso/${orgSlug}/saml/acs`;
  const xml = buildSpMetadata(entityId, acsUrl);

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
});

// GET /api/sso/:orgSlug/saml/login — redirect to IdP
ssoSamlRoutes.get('/:orgSlug/saml/login', async (c) => {
  const orgSlug = c.req.param('orgSlug');
  const db = c.get('db');

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1);
  if (!org) return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);

  const [config] = await db.select().from(ssoConfigs)
    .where(and(eq(ssoConfigs.orgId, org.id), eq(ssoConfigs.isActive, 1))).limit(1);
  if (!config || config.provider !== 'saml' || !config.ssoUrl) {
    return c.json({ error: 'Not Found', message: 'SAML SSO not configured' }, 404);
  }

  const entityId = `https://opensyber.cloud/sso/${orgSlug}`;
  const acsUrl = `https://opensyber.cloud/api/sso/${orgSlug}/saml/acs`;
  const authnRequest = buildAuthnRequest(entityId, acsUrl, config.ssoUrl);
  const encoded = btoa(authnRequest);
  const redirectUrl = `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(encoded)}`;

  return c.redirect(redirectUrl);
});

// POST /api/sso/:orgSlug/saml/acs — Assertion Consumer Service
ssoSamlRoutes.post('/:orgSlug/saml/acs', async (c) => {
  const orgSlug = c.req.param('orgSlug');
  const db = c.get('db');

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1);
  if (!org) return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);

  const [config] = await db.select().from(ssoConfigs)
    .where(and(eq(ssoConfigs.orgId, org.id), eq(ssoConfigs.isActive, 1))).limit(1);
  if (!config || config.provider !== 'saml') {
    return c.json({ error: 'Not Found', message: 'SAML SSO not configured' }, 404);
  }

  const formData = await c.req.parseBody();
  const samlResponse = formData['SAMLResponse'] as string;
  if (!samlResponse) return c.json({ error: 'Bad Request', message: 'Missing SAMLResponse' }, 400);

  const rawXml = atob(samlResponse);
  const parsed = parseSamlResponse(samlResponse);

  // Verify XML signature against IdP certificate
  if (config.certificate) {
    const response = parsed['Response'] ?? parsed['samlp:Response'] ?? parsed['saml2p:Response'];
    const sig = response && typeof response === 'object'
      ? ((response as Record<string, unknown>)['Signature'] ?? (response as Record<string, unknown>)['ds:Signature']) as Record<string, unknown> | undefined
      : undefined;
    const sigValue = sig
      ? ((sig['SignatureValue'] ?? (sig['ds:SignatureValue'])) as string ?? '')
      : '';
    if (!sigValue) {
      return c.json({ error: 'Unauthorized', message: 'SAML response missing signature' }, 401);
    }
    const valid = await validateSignature(rawXml, sigValue, config.certificate);
    if (!valid) {
      return c.json({ error: 'Unauthorized', message: 'SAML signature verification failed' }, 401);
    }
  } else {
    return c.json({ error: 'Bad Request', message: 'SSO certificate not configured — cannot verify assertion' }, 400);
  }

  const attrs = extractAttributes(parsed);
  if (!attrs || !attrs.email) {
    return c.json({ error: 'Unauthorized', message: 'Invalid SAML assertion' }, 401);
  }

  // Provision or find user
  const [existingUser] = await db.select().from(users).where(eq(users.email, attrs.email)).limit(1);
  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else if (config.autoProvision) {
    userId = generateId();
    const now = new Date().toISOString();
    await db.insert(users).values({
      id: userId, email: attrs.email, name: attrs.name, createdAt: now, updatedAt: now,
    });
  } else {
    return c.json({ error: 'Forbidden', message: 'User not provisioned' }, 403);
  }

  // Ensure org membership
  const [membership] = await db.select().from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, userId))).limit(1);

  if (!membership) {
    const now = new Date().toISOString();
    await db.insert(orgMembers).values({
      id: generateId(), orgId: org.id, userId, role: config.defaultRole as Role,
      invitedBy: org.ownerId, invitedAt: now, acceptedAt: now, status: 'active',
    });
  }

  // Generate session token and store behind a single-use code
  const token = await generateSsoToken(userId, c.env.AUTH_SECRET);
  const code = crypto.randomUUID();
  await c.env.CACHE.put(`sso:code:${code}`, token, { expirationTtl: 120 });
  // Redirect with code instead of token
  return c.redirect(`https://opensyber.cloud/dashboard?sso=success&org=${orgSlug}&code=${code}`);
});

export { ssoSamlRoutes };
