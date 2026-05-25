/**
 * Gateway-token KV helpers.
 *
 * New tokens are stored as SHA-256 hex digests at `gateway:{instanceId}`.
 * Legacy deployments that still hold raw tokens in that same slot continue
 * to work transparently — the verify path detects the format and compares
 * appropriately. Rotation migrates each instance to the hashed format.
 */
import { timingSafeCompare } from './timing-safe.js';

const KV_KEY_PREFIX = 'gateway:';
const DEFAULT_TTL_SECONDS = 90 * 86400;
const HASH_HEX_LENGTH = 64;
const HASH_HEX_RE = /^[0-9a-f]{64}$/;

function kvKey(instanceId: string): string {
  return `${KV_KEY_PREFIX}${instanceId}`;
}

export async function hashGatewayToken(raw: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function isHashed(stored: string): boolean {
  return stored.length === HASH_HEX_LENGTH && HASH_HEX_RE.test(stored);
}

export async function storeGatewayToken(
  kv: KVNamespace,
  instanceId: string,
  rawToken: string,
  options: { ttlSeconds?: number } = {},
): Promise<void> {
  const hash = await hashGatewayToken(rawToken);
  await kv.put(kvKey(instanceId), hash, {
    expirationTtl: options.ttlSeconds ?? DEFAULT_TTL_SECONDS,
  });
}

export async function deleteGatewayToken(kv: KVNamespace, instanceId: string): Promise<void> {
  await kv.delete(kvKey(instanceId));
}

/**
 * Verify that `providedToken` matches whatever is stored for `instanceId`.
 * Supports both hashed (new) and legacy raw storage. Uses constant-time
 * comparison in both paths.
 */
export async function verifyGatewayToken(
  kv: KVNamespace,
  instanceId: string,
  providedToken: string,
): Promise<boolean> {
  const stored = await kv.get(kvKey(instanceId));
  if (!stored) return false;

  if (isHashed(stored)) {
    const providedHash = await hashGatewayToken(providedToken);
    return timingSafeCompare(stored, providedHash);
  }
  return timingSafeCompare(stored, providedToken);
}

/**
 * Fetch a legacy raw token if one is still stored; returns null if the
 * instance has already migrated to hashed-only storage (rotation required).
 */
export async function getLegacyRawGatewayToken(
  kv: KVNamespace,
  instanceId: string,
): Promise<string | null> {
  const stored = await kv.get(kvKey(instanceId));
  if (!stored || isHashed(stored)) return null;
  return stored;
}
