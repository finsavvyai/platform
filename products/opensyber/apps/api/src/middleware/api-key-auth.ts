import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { apiKeys } from '@opensyber/db';
import type { Env, Variables } from '../types.js';

/** SHA-256 hash a string, return hex */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ApiKeyContext {
  apiKeyId: string;
  apiKeyUserId: string;
  apiKeyInstanceId: string | null;
  apiKeyScopes: string[];
  apiKeyRateLimit: number;
}

/**
 * Middleware that validates X-API-Key header against stored key hashes.
 * Sets apiKey context variables on success.
 */
export const apiKeyAuthMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables & ApiKeyContext;
}>(async (c, next) => {
  const rawKey = c.req.header('X-API-Key');

  if (!rawKey) {
    return c.json(
      { error: 'Unauthorized', message: 'Missing X-API-Key header' },
      401,
    );
  }

  if (!rawKey.startsWith('osk_live_')) {
    return c.json(
      { error: 'Unauthorized', message: 'Invalid API key format' },
      401,
    );
  }

  const keyHash = await sha256Hex(rawKey);
  const db = c.get('db');

  const [keyRecord] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!keyRecord) {
    return c.json(
      { error: 'Unauthorized', message: 'Invalid API key' },
      401,
    );
  }

  if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
    return c.json(
      { error: 'Unauthorized', message: 'API key expired' },
      401,
    );
  }

  const scopes: string[] = JSON.parse(keyRecord.scopes);

  c.set('apiKeyId', keyRecord.id);
  c.set('apiKeyUserId', keyRecord.userId);
  c.set('apiKeyInstanceId', keyRecord.instanceId);
  c.set('apiKeyScopes', scopes);
  c.set('apiKeyRateLimit', keyRecord.rateLimit ?? 100);

  // Update lastUsedAt asynchronously (fire-and-forget)
  c.executionCtx.waitUntil(
    db
      .update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, keyRecord.id)),
  );

  await next();
});

export { sha256Hex };
