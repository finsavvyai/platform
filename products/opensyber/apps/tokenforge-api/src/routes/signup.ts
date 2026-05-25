import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { tfTenants, tfApiKeys } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { hashApiKey } from '../lib/hash.js';
import { generateApiKey, extractKeyPrefix } from '../lib/api-key-gen.js';

export const signupRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  authProvider: z.string().optional(),
  authId: z.string().optional(),
});

/**
 * POST /public/signup — create a free tenant + API key.
 * Idempotent: if email already exists, returns existing tenant (no new key).
 */
signupRoutes.post('/', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'validation_error', message: 'Valid name and email required' }, 400);
  }

  const { name, email } = parsed.data;
  const slug = email.split('@')[0]?.replace(/[^a-z0-9-]/gi, '-').toLowerCase() ?? '';

  // Check if tenant already exists for this email
  const [existing] = await db
    .select()
    .from(tfTenants)
    .where(eq(tfTenants.slug, slug));

  if (existing) {
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const prefix = extractKeyPrefix(rawKey);
    const now = new Date().toISOString();

    await db.insert(tfApiKeys).values({
      id: crypto.randomUUID(),
      tenantId: existing.id,
      name: 'Auto',
      keyPrefix: prefix,
      keyHash,
      isActive: true,
      createdAt: now,
    });

    return c.json({
      data: {
        tenantId: existing.id,
        apiKey: rawKey,
        prefix,
        plan: existing.plan,
        existing: true,
      },
    });
  }

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
    data: {
      tenantId,
      apiKey: rawKey,
      prefix,
      plan: 'free',
      existing: false,
      message: 'Copy your API key now. It will not be shown again.',
    },
  }, 201);
});
