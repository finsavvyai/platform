import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashGatewayToken,
  storeGatewayToken,
  verifyGatewayToken,
  getLegacyRawGatewayToken,
  deleteGatewayToken,
} from './gateway-token.js';

interface MockKv {
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  delete: (key: string) => Promise<void>;
  _store: Map<string, string>;
  _ttls: Map<string, number | undefined>;
}

function createMockKv(): MockKv {
  const store = new Map<string, string>();
  const ttls = new Map<string, number | undefined>();
  return {
    _store: store,
    _ttls: ttls,
    put: async (key, value, opts) => { store.set(key, value); ttls.set(key, opts?.expirationTtl); },
    get: async (key) => store.get(key) ?? null,
    delete: async (key) => { store.delete(key); ttls.delete(key); },
  };
}

describe('gateway-token', () => {
  let kv: MockKv;

  beforeEach(() => { kv = createMockKv(); });

  it('hashGatewayToken produces 64-char hex SHA-256', async () => {
    const h = await hashGatewayToken('my-secret-token');
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash is deterministic for same input', async () => {
    const a = await hashGatewayToken('token-x');
    const b = await hashGatewayToken('token-x');
    expect(a).toBe(b);
  });

  it('storeGatewayToken stores hash (not raw) and sets 90-day TTL', async () => {
    await storeGatewayToken(kv as unknown as KVNamespace, 'inst-1', 'raw-token-1');
    const stored = kv._store.get('gateway:inst-1')!;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain('raw-token-1');
    expect(kv._ttls.get('gateway:inst-1')).toBe(90 * 86400);
  });

  it('verifyGatewayToken accepts matching token against hashed slot', async () => {
    await storeGatewayToken(kv as unknown as KVNamespace, 'inst-1', 'raw-token-1');
    expect(await verifyGatewayToken(kv as unknown as KVNamespace, 'inst-1', 'raw-token-1')).toBe(true);
  });

  it('verifyGatewayToken rejects wrong token against hashed slot', async () => {
    await storeGatewayToken(kv as unknown as KVNamespace, 'inst-1', 'raw-token-1');
    expect(await verifyGatewayToken(kv as unknown as KVNamespace, 'inst-1', 'attacker-token')).toBe(false);
  });

  it('verifyGatewayToken supports legacy raw-token slot (pre-migration)', async () => {
    await kv.put('gateway:inst-legacy', 'legacy-raw-token-value');
    expect(await verifyGatewayToken(kv as unknown as KVNamespace, 'inst-legacy', 'legacy-raw-token-value')).toBe(true);
    expect(await verifyGatewayToken(kv as unknown as KVNamespace, 'inst-legacy', 'wrong')).toBe(false);
  });

  it('verifyGatewayToken returns false when key is missing', async () => {
    expect(await verifyGatewayToken(kv as unknown as KVNamespace, 'nope', 'anything')).toBe(false);
  });

  it('getLegacyRawGatewayToken returns raw only for legacy slots', async () => {
    await kv.put('gateway:inst-legacy', 'legacy-raw-token-value');
    expect(await getLegacyRawGatewayToken(kv as unknown as KVNamespace, 'inst-legacy')).toBe('legacy-raw-token-value');

    await storeGatewayToken(kv as unknown as KVNamespace, 'inst-new', 'new-token');
    expect(await getLegacyRawGatewayToken(kv as unknown as KVNamespace, 'inst-new')).toBeNull();
  });

  it('deleteGatewayToken removes the KV entry', async () => {
    await storeGatewayToken(kv as unknown as KVNamespace, 'inst-1', 'raw-token-1');
    await deleteGatewayToken(kv as unknown as KVNamespace, 'inst-1');
    expect(kv._store.has('gateway:inst-1')).toBe(false);
  });

  it('treats a 64-hex value that happens to be a legacy token as hashed (unavoidable)', async () => {
    // This documents a known limitation: if a legacy raw token were *exactly*
    // 64 lowercase hex characters, it would be indistinguishable from a hash.
    // Token generation uses longer/mixed formats so this should not occur in
    // practice, but the verify behavior is well-defined.
    const fakeHashShaped = 'a'.repeat(64);
    await kv.put('gateway:inst-edge', fakeHashShaped);
    // Direct-compare path is skipped; hash-path will be taken and reject.
    expect(await verifyGatewayToken(kv as unknown as KVNamespace, 'inst-edge', fakeHashShaped)).toBe(false);
  });
});
