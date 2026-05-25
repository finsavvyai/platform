import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { tfTenants, tfApiKeys } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { hashApiKey } from '../lib/hash.js';
import { generateApiKey, extractKeyPrefix } from '../lib/api-key-gen.js';

export const internalProvisionRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const provisionSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

/**
 * POST /internal/provision — create tenant + API key.
 * Protected by X-Internal-Secret header (server-to-server only).
 */
internalProvisionRoutes.post('/', async (c) => {
  const secret = c.req.header('X-Internal-Secret');
  if (!secret || secret !== c.env.INTERNAL_API_SECRET) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const db = c.get('db');
  const parsed = provisionSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'invalid_request' }, 400);
  }

  const { name, email } = parsed.data;
  const slug = email.split('@')[0]?.replace(/[^a-z0-9-]/gi, '-').toLowerCase() ?? '';

  // Check existing
  const [existing] = await db
    .select()
    .from(tfTenants)
    .where(eq(tfTenants.slug, slug));

  if (existing) {
    return c.json({
      data: { tenantId: existing.id, apiKey: null, existing: true },
    });
  }

  // Create tenant
  const tenantId = `tf_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  await db.insert(tfTenants).values({
    id: tenantId,
    name,
    slug,
    ownerUserId: tenantId,
    plan: 'free',
    createdAt: now,
    updatedAt: now,
  });

  // Generate API key
  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const prefix = extractKeyPrefix(rawKey);

  await db.insert(tfApiKeys).values({
    id: crypto.randomUUID(),
    tenantId,
    name: 'Default',
    keyPrefix: prefix,
    keyHash,
    isActive: true,
    createdAt: now,
  });

  return c.json({
    data: { tenantId, apiKey: rawKey, existing: false },
  }, 201);
});
