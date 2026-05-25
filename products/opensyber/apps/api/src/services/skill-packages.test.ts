import { describe, it, expect, vi, beforeEach } from 'vitest';
import { skillPackageService } from './skill-packages.js';

function createMockR2Bucket() {
  const store = new Map<string, { data: ArrayBuffer; metadata?: Record<string, string> }>();

  return {
    put: vi.fn(async (key: string, data: ArrayBuffer, opts?: { customMetadata?: Record<string, string> }) => {
      store.set(key, { data, metadata: opts?.customMetadata });
    }),
    get: vi.fn(async (key: string) => {
      const item = store.get(key);
      if (!item) return null;
      return {
        arrayBuffer: async () => item.data,
        body: null,
        customMetadata: item.metadata,
      };
    }),
    head: vi.fn(async (key: string) => {
      return store.has(key) ? { key } : null;
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  };
}

describe('skillPackageService', () => {
  let storage: ReturnType<typeof createMockR2Bucket>;

  beforeEach(() => {
    storage = createMockR2Bucket();
  });

  describe('upload', () => {
    it('stores package in R2 with correct key', async () => {
      const data = new TextEncoder().encode('fake-tarball').buffer;
      const result = await skillPackageService.upload('github-integration', '1.0.0', data, storage as any);

      expect(result.slug).toBe('github-integration');
      expect(result.version).toBe('1.0.0');
      expect(result.size).toBe(data.byteLength);
      expect(storage.put).toHaveBeenCalledWith(
        'skills/github-integration/1.0.0.tar.gz',
        data,
        expect.objectContaining({ customMetadata: expect.objectContaining({ slug: 'github-integration' }) }),
      );
    });
  });

  describe('download', () => {
    it('returns bytes + recomputed sha256 for existing package', async () => {
      const data = new TextEncoder().encode('tarball-data').buffer;
      storage._store.set('skills/test-skill/1.0.0.tar.gz', { data });

      const result = await skillPackageService.download('test-skill', '1.0.0', storage as any);
      expect(result).not.toBeNull();
      expect(result!.bytes).toBeInstanceOf(ArrayBuffer);
      expect(new TextDecoder().decode(new Uint8Array(result!.bytes))).toBe('tarball-data');
      expect(result!.sha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns null for missing package', async () => {
      const result = await skillPackageService.download('nonexistent', '1.0.0', storage as any);
      expect(result).toBeNull();
    });

    it('throws when stored sha256 metadata does not match downloaded bytes (tampering detected)', async () => {
      const data = new TextEncoder().encode('legit').buffer;
      storage._store.set('skills/test-skill/1.0.0.tar.gz', {
        data,
        metadata: { sha256: '0'.repeat(64) }, // wrong hash
      });
      await expect(
        skillPackageService.download('test-skill', '1.0.0', storage as any),
      ).rejects.toThrow(/integrity check failed/);
    });
  });

  describe('exists', () => {
    it('returns true when package exists', async () => {
      const data = new TextEncoder().encode('data').buffer;
      storage._store.set('skills/my-skill/2.0.0.tar.gz', { data });

      const result = await skillPackageService.exists('my-skill', '2.0.0', storage as any);
      expect(result).toBe(true);
    });

    it('returns false when package does not exist', async () => {
      const result = await skillPackageService.exists('missing', '1.0.0', storage as any);
      expect(result).toBe(false);
    });
  });

  describe('remove', () => {
    it('deletes package from R2', async () => {
      await skillPackageService.remove('old-skill', '0.9.0', storage as any);
      expect(storage.delete).toHaveBeenCalledWith('skills/old-skill/0.9.0.tar.gz');
    });
  });

  describe('getBase64', () => {
    it('returns base64 encoded data + sha256 for existing package', async () => {
      const text = 'hello-world';
      const data = new TextEncoder().encode(text).buffer;
      storage._store.set('skills/b64-skill/1.0.0.tar.gz', { data });

      const result = await skillPackageService.getBase64('b64-skill', '1.0.0', storage as any);
      expect(result).toBeTruthy();
      expect(atob(result!.base64)).toBe(text);
      expect(result!.sha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns null for missing package', async () => {
      const result = await skillPackageService.getBase64('missing', '1.0.0', storage as any);
      expect(result).toBeNull();
    });
  });
});
