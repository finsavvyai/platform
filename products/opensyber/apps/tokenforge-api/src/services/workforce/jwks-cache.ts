/**
 * KV-backed JWKS cache.
 *
 * Each issuer's JWKS is fetched lazily on first use and stored under
 * `jwks:<issuer-hash>` with the fetch timestamp. Entries older than
 * 24h trigger a refetch; if the refetch fails we serve the stale
 * value rather than fail the login. Entries persist in KV without a
 * TTL so the stale fallback actually has something to return.
 */

import type { JwksKey } from '@opensyber/tokenforge/server/internal';

const FRESH_FOR_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4_000;

export interface JwksFetcher {
  (jwksUri: string): Promise<{ keys: JwksKey[] } | null>;
}

interface CachedEntry {
  keys: JwksKey[];
  fetchedAt: number;
}

export async function getJwks(
  cache: KVNamespace,
  jwksUri: string,
  fetcher: JwksFetcher = defaultFetcher,
  now: number = Date.now(),
): Promise<{ keys: JwksKey[] } | null> {
  const key = await cacheKey(jwksUri);
  const cached = (await cache.get(key, 'json').catch(() => null)) as CachedEntry | null;

  if (cached && now - cached.fetchedAt < FRESH_FOR_MS) {
    return { keys: cached.keys };
  }

  const fresh = await fetcher(jwksUri);
  if (fresh) {
    const entry: CachedEntry = { keys: fresh.keys, fetchedAt: now };
    await cache.put(key, JSON.stringify(entry)).catch(() => undefined);
    return { keys: fresh.keys };
  }

  if (cached) return { keys: cached.keys };
  return null;
}

async function defaultFetcher(jwksUri: string): Promise<{ keys: JwksKey[] } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(jwksUri, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { keys?: JwksKey[] };
    if (!json.keys || !Array.isArray(json.keys)) return null;
    return { keys: json.keys };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function cacheKey(jwksUri: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jwksUri));
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `jwks:${hex.slice(0, 32)}`;
}
