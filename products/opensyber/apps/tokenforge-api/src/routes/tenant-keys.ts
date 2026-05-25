import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { tfApiKeys } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { PLAN_DOMAIN_LIMITS } from '../types.js';
import { logAudit } from '../services/audit-log.js';
import { tenantKeyCreateRoutes } from './tenant-keys-create.js';

export const tenantKeyRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

tenantKeyRoutes.route('/', tenantKeyCreateRoutes);

/** GET /v1/tenant/api-keys — list API keys with allowed domains */
tenantKeyRoutes.get('/api-keys', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const keys = await db
    .select({
      id: tfApiKeys.id,
      name: tfApiKeys.name,
      prefix: tfApiKeys.keyPrefix,
      isActive: tfApiKeys.isActive,
      lastUsedAt: tfApiKeys.lastUsedAt,
      expiresAt: tfApiKeys.expiresAt,
      createdAt: tfApiKeys.createdAt,
    })
    .from(tfApiKeys)
    .where(eq(tfApiKeys.tenantId, tenantId));

  const enriched = await Promise.all(
    keys.map(async (key) => {
      const domainsJson = await c.env.CACHE.get(`domains:${key.id}`);
      const allowedDomains = domainsJson ? (JSON.parse(domainsJson) as string[]) : [];
      return { ...key, allowedDomains };
    }),
  );

  return c.json({ data: enriched });
});

const updateDomainsSchema = z.object({
  allowedDomains: z.array(z.string().min(1).max(253)).max(100),
});

/** PUT /v1/tenant/api-keys/:id/domains — update allowed domains */
tenantKeyRoutes.put('/api-keys/:id/domains', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const plan = c.get('tenantPlan');
  const keyId = c.req.param('id');

  const body = await c.req.json();
  const parsed = updateDomainsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', message: 'Invalid request body' }, 400);
  }

  const [existing] = await db
    .select({ id: tfApiKeys.id })
    .from(tfApiKeys)
    .where(and(eq(tfApiKeys.id, keyId), eq(tfApiKeys.tenantId, tenantId)));

  if (!existing) {
    return c.json({ error: 'not_found', message: 'API key not found' }, 404);
  }

  const { allowedDomains } = parsed.data;
  const domainLimit = PLAN_DOMAIN_LIMITS[plan] ?? PLAN_DOMAIN_LIMITS['free']!;
  if (domainLimit !== Infinity && allowedDomains.length > domainLimit) {
    return c.json(
      { error: 'plan_limit', message: `Your plan allows a maximum of ${domainLimit} domains per key` },
      403,
    );
  }

  const domains = allowedDomains.filter(Boolean);
  if (domains.length > 0) {
    await c.env.CACHE.put(`domains:${keyId}`, JSON.stringify(domains));
  } else {
    await c.env.CACHE.delete(`domains:${keyId}`);
  }

  c.executionCtx.waitUntil(
    logAudit(c.env, 'api_key.domains_updated', tenantId, { keyId, allowedDomains: domains }),
  );

  return c.json({ data: { id: keyId, allowedDomains: domains } });
});

/** DELETE /v1/tenant/api-keys/:id — revoke an API key */
tenantKeyRoutes.delete('/api-keys/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const keyId = c.req.param('id');

  const [existing] = await db
    .select()
    .from(tfApiKeys)
    .where(and(eq(tfApiKeys.id, keyId), eq(tfApiKeys.tenantId, tenantId)));

  if (!existing) {
    return c.json({ error: 'not_found', message: 'API key not found' }, 404);
  }

  await db.update(tfApiKeys).set({ isActive: false }).where(
    and(eq(tfApiKeys.id, keyId), eq(tfApiKeys.tenantId, tenantId)),
  );

  // Clean up domain allowlist from KV
  c.executionCtx.waitUntil(c.env.CACHE.delete(`domains:${keyId}`));
  c.executionCtx.waitUntil(logAudit(c.env, 'api_key.revoked', tenantId, { keyId }));

  return c.json({ data: { id: keyId, revoked: true } });
});
