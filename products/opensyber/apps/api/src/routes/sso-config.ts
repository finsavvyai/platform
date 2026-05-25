import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { ssoConfigs, organizations } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';
import { encrypt } from '../utils/encryption.js';
import { upsertSsoConfigSchema } from './validation/sso-config.js';

const ssoConfigRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

ssoConfigRoutes.use('*', dbMiddleware, authMiddleware);

// GET /api/organizations/:orgId/sso — get SSO config
ssoConfigRoutes.get('/:orgId/sso', requirePermission('org.update'), async (c) => {
  const db = c.get('db');
  const orgId = c.req.param('orgId');

  const [config] = await db.select().from(ssoConfigs)
    .where(eq(ssoConfigs.orgId, orgId)).limit(1);

  if (!config) {
    return c.json({ data: null });
  }

  // Strip encrypted secret from response
  const { oidcClientSecretEncrypted: _, ...safe } = config;
  return c.json({ data: { ...safe, hasClientSecret: !!config.oidcClientSecretEncrypted } });
});

// PUT /api/organizations/:orgId/sso — create or update SSO config
ssoConfigRoutes.put('/:orgId/sso', requirePermission('org.update'), async (c) => {
  const db = c.get('db');
  const orgId = c.req.param('orgId');
  const parsed = upsertSsoConfigSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const now = new Date().toISOString();
  const [existing] = await db.select({ id: ssoConfigs.id }).from(ssoConfigs)
    .where(eq(ssoConfigs.orgId, orgId)).limit(1);

  const values = {
    orgId,
    provider: body.provider,
    entityId: body.entityId ?? null,
    ssoUrl: body.ssoUrl ?? null,
    certificate: body.certificate ?? null,
    oidcClientId: body.oidcClientId ?? null,
    oidcClientSecretEncrypted: body.oidcClientSecret
      ? await encrypt(body.oidcClientSecret, c.env.ENCRYPTION_KEY)
      : null,
    oidcIssuer: body.oidcIssuer ?? null,
    autoProvision: body.autoProvision ? 1 : 0,
    defaultRole: body.defaultRole,
    isActive: body.isActive ? 1 : 0,
    updatedAt: now,
  };

  if (existing) {
    await db.update(ssoConfigs).set(values).where(eq(ssoConfigs.id, existing.id));
    return c.json({ data: { id: existing.id, ...values } });
  }

  const id = generateId();
  await db.insert(ssoConfigs).values({ id, ...values, createdAt: now });
  return c.json({ data: { id, ...values, createdAt: now } }, 201);
});

// DELETE /api/organizations/:orgId/sso — delete SSO config
ssoConfigRoutes.delete('/:orgId/sso', requirePermission('org.update'), async (c) => {
  const db = c.get('db');
  const orgId = c.req.param('orgId');

  await db.delete(ssoConfigs).where(eq(ssoConfigs.orgId, orgId));
  return c.json({ deleted: true });
});

// POST /api/organizations/:orgId/sso/test — test SSO connection
ssoConfigRoutes.post('/:orgId/sso/test', requirePermission('org.update'), async (c) => {
  const db = c.get('db');
  const orgId = c.req.param('orgId');

  const [config] = await db.select().from(ssoConfigs)
    .where(eq(ssoConfigs.orgId, orgId)).limit(1);

  if (!config) {
    return c.json({ error: 'Not Found', message: 'SSO not configured' }, 404);
  }

  if (config.provider === 'oidc' && config.oidcIssuer) {
    try {
      const res = await fetch(`${config.oidcIssuer}/.well-known/openid-configuration`);
      if (!res.ok) return c.json({ success: false, message: 'OIDC discovery failed' });
      return c.json({ success: true, message: 'OIDC provider reachable' });
    } catch {
      return c.json({ success: false, message: 'Failed to reach OIDC provider' });
    }
  }

  if (config.provider === 'saml' && config.ssoUrl) {
    return c.json({ success: true, message: 'SAML configuration present' });
  }

  return c.json({ success: false, message: 'Incomplete configuration' });
});

export { ssoConfigRoutes };
