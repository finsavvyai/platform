import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getJwks, type JwksFetcher } from './jwks-cache.js';
import type { JwksKey } from '@opensyber/tokenforge/server/internal';

const FRESH_FOR_MS = 24 * 60 * 60 * 1000;
const URI = 'https://idp.example/.well-known/jwks.json';

const sampleKeys: JwksKey[] = [{
  kid: 'kid-1', kty: 'RSA', alg: 'RS256', n: 'modulus', e: 'AQAB',
}];

interface MockKv {
  store: Map<string, string>;
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
}

function makeKv(): MockKv {
  const store = new Map<string, string>();
  const kv: MockKv = {
    store,
    get: vi.fn(async (key: string, _kind: 'json') => {
      const value = store.get(key);
      return value ? JSON.parse(value) : null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
  return kv;
}

async function seedFresh(kv: MockKv, now: number): Promise<void> {
  const fetcher = vi.fn(async () => ({ keys: sampleKeys })) as JwksFetcher;
  await getJwks(kv as unknown as KVNamespace, URI, fetcher, now);
}

describe('getJwks', () => {
  let kv: MockKv;
  beforeEach(() => {
    kv = makeKv();
  });

  it('returns cached when entry is fresh and never calls fetcher', async () => {
    const now = 1_700_000_000_000;
    await seedFresh(kv, now);
    const fetcher = vi.fn(async () => null) as JwksFetcher;
    const result = await getJwks(kv as unknown as KVNamespace, URI, fetcher, now + 1_000);
    expect(result).toEqual({ keys: sampleKeys });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('calls fetcher on cache miss and stores the result with fetchedAt', async () => {
    const fetcher = vi.fn(async () => ({ keys: sampleKeys })) as JwksFetcher;
    const now = 1_700_000_000_000;
    const result = await getJwks(kv as unknown as KVNamespace, URI, fetcher, now);
    expect(result).toEqual({ keys: sampleKeys });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(kv.put).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(kv.store.values().next().value as string);
    expect(stored.keys).toEqual(sampleKeys);
    expect(stored.fetchedAt).toBe(now);
  });

  it('refetches when cached entry exceeds the 24h freshness window', async () => {
    const now = 1_700_000_000_000;
    await seedFresh(kv, now);
    const fresherKeys: JwksKey[] = [{ kid: 'kid-2', kty: 'RSA', alg: 'RS256', n: 'mod2', e: 'AQAB' }];
    const fetcher = vi.fn(async () => ({ keys: fresherKeys })) as JwksFetcher;
    const later = now + FRESH_FOR_MS + 1;
    const result = await getJwks(kv as unknown as KVNamespace, URI, fetcher, later);
    expect(result).toEqual({ keys: fresherKeys });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serves stale value when fetcher fails after cache expired', async () => {
    const now = 1_700_000_000_000;
    await seedFresh(kv, now);
    const fetcher = vi.fn(async () => null) as JwksFetcher;
    const later = now + FRESH_FOR_MS + 1;
    const result = await getJwks(kv as unknown as KVNamespace, URI, fetcher, later);
    expect(result).toEqual({ keys: sampleKeys });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(kv.put).toHaveBeenCalledTimes(1); // only seedFresh's put
  });

  it('returns null on cache miss when fetcher fails', async () => {
    const fetcher = vi.fn(async () => null) as JwksFetcher;
    const now = 1_700_000_000_000;
    const result = await getJwks(kv as unknown as KVNamespace, URI, fetcher, now);
    expect(result).toBeNull();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('treats KV get throws as cache miss', async () => {
    kv.get = vi.fn(async () => { throw new Error('kv-down'); });
    const fetcher = vi.fn(async () => ({ keys: sampleKeys })) as JwksFetcher;
    const now = 1_700_000_000_000;
    const result = await getJwks(kv as unknown as KVNamespace, URI, fetcher, now);
    expect(result).toEqual({ keys: sampleKeys });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('hashes the jwksUri so different URIs do not collide', async () => {
    const fetcher = vi.fn(async () => ({ keys: sampleKeys })) as JwksFetcher;
    const now = 1_700_000_000_000;
    await getJwks(kv as unknown as KVNamespace, 'https://idp.a/jwks', fetcher, now);
    await getJwks(kv as unknown as KVNamespace, 'https://idp.b/jwks', fetcher, now);
    const keys = Array.from(kv.store.keys());
    expect(keys.length).toBe(2);
    expect(keys[0]).not.toBe(keys[1]);
    for (const k of keys) expect(k.startsWith('jwks:')).toBe(true);
  });

  it('swallows KV.put failure and still returns the fresh keys (defensive)', async () => {
    kv.put = vi.fn(async () => { throw new Error('kv-write-down'); });
    const fetcher = vi.fn(async () => ({ keys: sampleKeys })) as JwksFetcher;
    const now = 1_700_000_000_000;
    const result = await getJwks(kv as unknown as KVNamespace, URI, fetcher, now);
    expect(result).toEqual({ keys: sampleKeys });
  });

  it('treats now - fetchedAt === FRESH_FOR_MS as STALE (strict-less-than freshness)', async () => {
    const now = 1_700_000_000_000;
    await seedFresh(kv, now);
    const fetcher = vi.fn(async () => ({ keys: sampleKeys })) as JwksFetcher;
    // Exactly at the boundary: 24h since fetch — should refetch, not serve cached
    await getJwks(kv as unknown as KVNamespace, URI, fetcher, now + FRESH_FOR_MS);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('defaultFetcher returns null when JWKS endpoint returns non-200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    const result = await getJwks(kv as unknown as KVNamespace, URI, undefined, 1_700_000_000_000);
    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it('defaultFetcher returns null when JSON body lacks the `keys` array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ wrong: [] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })));
    const result = await getJwks(kv as unknown as KVNamespace, URI, undefined, 1_700_000_000_000);
    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it('defaultFetcher returns null on network error (fetch throws)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const result = await getJwks(kv as unknown as KVNamespace, URI, undefined, 1_700_000_000_000);
    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });
});
