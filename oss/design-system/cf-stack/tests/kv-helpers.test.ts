import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  kvGet,
  kvSet,
  kvDelete,
  kvList,
} from '../src/kv/helpers';
import type { KVNamespace } from '../src/bindings';

describe('kv helpers', () => {
  let mockKV: Partial<KVNamespace>;

  beforeEach(() => {
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
    };
  });

  describe('kvGet', () => {
    it('should return parsed JSON value', async () => {
      const value = { id: 1, name: 'test' };
      (mockKV.get as any).mockResolvedValueOnce(JSON.stringify(value));

      const result = await kvGet(mockKV as KVNamespace, 'key');

      expect(result).toEqual(value);
    });

    it('should return string value as-is if not JSON', async () => {
      (mockKV.get as any).mockResolvedValueOnce('plain string');

      const result = await kvGet(mockKV as KVNamespace, 'key');

      expect(result).toBe('plain string');
    });

    it('should return null when key not found', async () => {
      (mockKV.get as any).mockResolvedValueOnce(null);

      const result = await kvGet(mockKV as KVNamespace, 'key');

      expect(result).toBeNull();
    });

    it('should call kv.get with correct key', async () => {
      await kvGet(mockKV as KVNamespace, 'my-key');

      expect(mockKV.get).toHaveBeenCalledWith('my-key');
    });
  });

  describe('kvSet', () => {
    it('should store JSON serialized value', async () => {
      const value = { id: 1, name: 'test' };

      await kvSet(mockKV as KVNamespace, 'key', value);

      expect(mockKV.put).toHaveBeenCalledWith('key', JSON.stringify(value), {});
    });

    it('should store string values as-is', async () => {
      await kvSet(mockKV as KVNamespace, 'key', 'plain string');

      expect(mockKV.put).toHaveBeenCalledWith('key', 'plain string', {});
    });

    it('should include TTL when provided', async () => {
      const value = { data: 'test' };

      await kvSet(mockKV as KVNamespace, 'key', value, 3600);

      expect(mockKV.put).toHaveBeenCalledWith(
        'key',
        JSON.stringify(value),
        { expirationTtl: 3600 },
      );
    });

    it('should handle undefined TTL', async () => {
      await kvSet(mockKV as KVNamespace, 'key', 'value', undefined);

      expect(mockKV.put).toHaveBeenCalledWith('key', 'value', {});
    });
  });

  describe('kvDelete', () => {
    it('should delete key from KV', async () => {
      await kvDelete(mockKV as KVNamespace, 'key');

      expect(mockKV.delete).toHaveBeenCalledWith('key');
    });

    it('should handle multiple deletes', async () => {
      await kvDelete(mockKV as KVNamespace, 'key1');
      await kvDelete(mockKV as KVNamespace, 'key2');

      expect(mockKV.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('kvList', () => {
    it('should return list of keys with prefix', async () => {
      (mockKV.list as any).mockResolvedValueOnce({
        keys: [{ name: 'key1' }, { name: 'key2' }],
        list_complete: true,
      });

      const result = await kvList(mockKV as KVNamespace, 'prefix:');

      expect(result).toEqual(['key1', 'key2']);
      expect(mockKV.list).toHaveBeenCalledWith({ prefix: 'prefix:' });
    });

    it('should handle empty list', async () => {
      (mockKV.list as any).mockResolvedValueOnce({
        keys: [],
        list_complete: true,
      });

      const result = await kvList(mockKV as KVNamespace, 'prefix:');

      expect(result).toEqual([]);
    });

    it('should extract key names correctly', async () => {
      (mockKV.list as any).mockResolvedValueOnce({
        keys: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
        list_complete: true,
      });

      const result = await kvList(mockKV as KVNamespace, 'p:');

      expect(result).toHaveLength(3);
      expect(result[0]).toBe('a');
    });
  });
});
