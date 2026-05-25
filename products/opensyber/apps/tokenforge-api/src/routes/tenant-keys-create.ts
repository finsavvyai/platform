import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { tfApiKeys } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { PLAN_KEY_LIMITS, PLAN_DOMAIN_LIMITS } from '../types.js';
import { hashApiKey } from '../lib/hash.js';
import { generateApiKey, extractKeyPrefix } from '../lib/api-key-gen.js';
import { logAudit } from '../services/audit-log.js';

export const tenantKeyCreateRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const createApiKeySchema = z.object({
  name: z.string().min(1).max(64),
  expiresInDays: z.number().int().positive().optional(),
  allowedDomains: z.array(z.string().min(1).max(253)).max(100).optional(),
});

/** POST /v1/tenant/api-keys — generate new API key */
tenantKeyCreateRoutes.post('/api-keys', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const plan = c.get('tenantPlan');

  const body = await c.req.json();
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', message: 'Invalid request body' }, 400);
  }

  // Enforce key count limit per plan
  const keyLimit = PLAN_KEY_LIMITS[plan] ?? PLAN_KEY_LIMITS['free']!;
  if (keyLimit !== Infinity) {
    const existing = await db
      .select({ id: tfApiKeys.id })
      .from(tfApiKeys)
      .where(and(eq(tfApiKeys.tenantId, tenantId), eq(tfApiKeys.isActive, true)));
    if (existing.length >= keyLimit) {
      return c.json(
        { error: 'plan_limit', message: `Your plan allows a maximum of ${keyLimit} API keys` },
        403,
      );
    }
  }

  const { name, expiresInDays, allowedDomains } = parsed.data;

  // Enforce domain count limit per plan
  if (allowedDomains && allowedDomains.length > 0) {
    const domainLimit = PLAN_DOMAIN_LIMITS[plan] ?? PLAN_DOMAIN_LIMITS['free']!;
    if (domainLimit !== Infinity && allowedDomains.length > domainLimit) {
      return c.json(
        { error: 'plan_limit', message: `Your plan allows a maximum of ${domainLimit} domains per key` },
        403,
      );
    }
  }

  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const prefix = extractKeyPrefix(rawKey);
  const id = crypto.randomUUID();

  let expiresAt: string | null = null;
  if (expiresInDays) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + expiresInDays);
    expiresAt = expDate.toISOString();
  }

  await db.insert(tfApiKeys).values({
    id,
    tenantId,
    name,
    keyPrefix: prefix,
    keyHash,
    expiresAt,
    isActive: true,
    createdAt: new Date().toISOString(),
  });

  // Store allowed domains in KV
  const domains = allowedDomains?.filter(Boolean) ?? [];
  if (domains.length > 0) {
    await c.env.CACHE.put(`domains:${id}`, JSON.stringify(domains));
  }

  c.executionCtx.waitUntil(
    logAudit(c.env, 'api_key.created', tenantId, { keyId: id, keyName: name, allowedDomains: domains }),
  );

  return c.json({
    data: { id, name, key: rawKey, prefix, expiresAt, allowedDomains: domains, createdAt: new Date().toISOString() },
  }, 201);
});
