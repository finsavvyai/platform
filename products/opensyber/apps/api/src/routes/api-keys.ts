import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { apiKeys } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { sha256Hex } from '../middleware/api-key-auth.js';

const apiKeyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

apiKeyRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

const createKeySchema = z.object({
  name: z.string().min(1).max(64),
  instanceId: z.string().optional(),
  scopes: z.array(z.enum(['ingest', 'read', 'write'])).default(['ingest']),
  rateLimit: z.number().int().min(1).max(10000).default(100),
  expiresAt: z.string().datetime().optional(),
});

/** Generate a cryptographically random API key */
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const randomPart = Array.from(array, (b) => chars[b % chars.length]).join('');
  return `osk_live_${randomPart}`;
}

/** POST /api/keys — Generate a new API key */
apiKeyRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const parsed = createKeySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const rawKey = generateApiKey();
  const keyHash = await sha256Hex(rawKey);
  const prefix = rawKey.slice(0, 16);
  const id = generateId();

  await db.insert(apiKeys).values({
    id,
    userId,
    instanceId: body.instanceId ?? null,
    name: body.name,
    keyHash,
    prefix,
    scopes: JSON.stringify(body.scopes),
    rateLimit: body.rateLimit,
    expiresAt: body.expiresAt ?? null,
  });

  return c.json(
    {
      id,
      key: rawKey,
      name: body.name,
      prefix,
      scopes: body.scopes,
      createdAt: new Date().toISOString(),
    },
    201,
  );
});

/** GET /api/keys — List user's API keys (never returns full key) */
apiKeyRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      scopes: apiKeys.scopes,
      rateLimit: apiKeys.rateLimit,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  const parsed = keys.map((k) => ({
    ...k,
    scopes: JSON.parse(k.scopes) as string[],
  }));

  return c.json({ keys: parsed });
});

/** DELETE /api/keys/:id — Revoke an API key */
apiKeyRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const keyId = c.req.param('id');

  const [existing] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Not found', message: 'API key not found' }, 404);
  }

  await db.delete(apiKeys).where(eq(apiKeys.id, keyId));

  return c.json({ success: true });
});

export { apiKeyRoutes };
