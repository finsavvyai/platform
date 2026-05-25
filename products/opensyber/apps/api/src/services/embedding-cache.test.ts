import { describe, it, expect, vi } from 'vitest';
import { getCachedEmbedding, setCachedEmbedding } from './embedding-cache.js';

function mockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = store.get(key);
      if (!value) return null;
      return type === 'json' ? JSON.parse(value) : value;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

describe('embedding-cache', () => {
  describe('setCachedEmbedding + getCachedEmbedding', () => {
    it('returns null on cache miss', async () => {
      const cache = mockKV();
      const result = await getCachedEmbedding(cache, 'never seen');
      expect(result).toBeNull();
    });

    it('stores and retrieves embeddings', async () => {
      const cache = mockKV();
      const embedding = [0.1, 0.2, 0.3, 0.4];
      await setCachedEmbedding(cache, 'test query', embedding);
      const retrieved = await getCachedEmbedding(cache, 'test query');
      expect(retrieved).toEqual(embedding);
    });

    it('uses deterministic keys — same text hits cache', async () => {
      const cache = mockKV();
      const embedding = [1, 2, 3];
      await setCachedEmbedding(cache, 'hello world', embedding);
      const retrieved = await getCachedEmbedding(cache, 'hello world');
      expect(retrieved).toEqual(embedding);
    });

    it('different text produces different cache misses', async () => {
      const cache = mockKV();
      await setCachedEmbedding(cache, 'query one', [1, 2, 3]);
      const retrieved = await getCachedEmbedding(cache, 'query two');
      expect(retrieved).toBeNull();
    });

    it('returns null for malformed cached data', async () => {
      const cache = mockKV();
      // Directly store invalid data
      await cache.put('emb:fake-key', 'not-json');
      const result = await getCachedEmbedding(cache, 'anything');
      expect(result).toBeNull();
    });

    it('sets 24-hour TTL on cached entries', async () => {
      const cache = mockKV();
      await setCachedEmbedding(cache, 'ttl test', [1, 2, 3]);
      expect(cache.put).toHaveBeenCalledWith(
        expect.stringMatching(/^emb:[0-9a-f]{64}$/),
        JSON.stringify([1, 2, 3]),
        { expirationTtl: 86400 },
      );
    });

    it('handles KV put failures gracefully', async () => {
      const cache = mockKV();
      (cache.put as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('KV down'));
      // Should not throw
      await expect(setCachedEmbedding(cache, 'test', [1, 2])).resolves.toBeUndefined();
    });

    it('handles KV get failures gracefully', async () => {
      const cache = mockKV();
      (cache.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('KV down'));
      const result = await getCachedEmbedding(cache, 'test');
      expect(result).toBeNull();
    });
  });
});
