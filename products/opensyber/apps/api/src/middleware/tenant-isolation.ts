import { eq, and } from 'drizzle-orm';
import { integrationConnections } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * Tenant-isolated KV get: reads from tenant:{userId}:credentials:{integrationSlug}:{key}
 */
export async function tenantKvGet(
  kv: KVNamespace,
  userId: string,
  slug: string,
  key: string,
): Promise<string | null> {
  const prefixedKey = `tenant:${userId}:credentials:${slug}:${key}`;
  return kv.get(prefixedKey);
}

/**
 * Tenant-isolated KV put: writes to tenant:{userId}:credentials:{integrationSlug}:{key}
 */
export async function tenantKvPut(
  kv: KVNamespace,
  userId: string,
  slug: string,
  key: string,
  value: string,
  expirationTtl?: number,
): Promise<void> {
  const prefixedKey = `tenant:${userId}:credentials:${slug}:${key}`;
  await kv.put(prefixedKey, value, { expirationTtl });
}

/**
 * Tenant-isolated KV delete: removes tenant:{userId}:credentials:{integrationSlug}:{key}
 */
export async function tenantKvDelete(
  kv: KVNamespace,
  userId: string,
  slug: string,
  key: string,
): Promise<void> {
  const prefixedKey = `tenant:${userId}:credentials:${slug}:${key}`;
  await kv.delete(prefixedKey);
}

/**
 * Verify that userId owns the integration connection.
 * Returns true if user has access to this connection; false otherwise.
 */
export async function validateTenantScope(
  db: DrizzleD1Database<any>,
  userId: string,
  connectionId: string,
): Promise<boolean> {
  const [conn] = await db
    .select({ id: integrationConnections.id })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.userId, userId),
      ),
    );

  return !!conn;
}

/**
 * Extract tenantId from request (via header, cookie, or JWT claim).
 * Placeholder — actual implementation depends on auth strategy.
 */
export function extractTenantId(headers: Headers): string | null {
  // Try Authorization header first (from JWT)
  const auth = headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    try {
      // In production, decode JWT to extract userId
      // For now, assume userId is in context via authMiddleware
      return null;
    } catch {
      return null;
    }
  }
  return null;
}
