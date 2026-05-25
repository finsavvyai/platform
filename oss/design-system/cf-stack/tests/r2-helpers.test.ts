import { describe, it, expect, beforeEach, vi } from 'vitest';
import { r2Put, r2Get, r2Delete, r2List } from '../src/r2/helpers';
import type { R2Bucket } from '../src/bindings';

describe('r2 helpers', () => {
  let mockR2: Partial<R2Bucket>;

  beforeEach(() => {
    mockR2 = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue({ key: 'key', size: 0, etag: '' }),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
    };
  });

  describe('r2Put', () => {
    it('should put object into R2', async () => {
      const mockObject = {
        key: 'test.txt',
        size: 100,
        etag: 'abc123',
        httpMetadata: {},
      };
      (mockR2.put as any).mockResolvedValueOnce(mockObject);

      const result = await r2Put(mockR2 as R2Bucket, 'test.txt', 'content');

      expect(result).toEqual(mockObject);
      expect(mockR2.put).toHaveBeenCalledWith('test.txt', 'content');
    });

    it('should set content type when provided', async () => {
      const mockObject = {
        key: 'test.txt',
        size: 100,
        etag: 'abc123',
        httpMetadata: {},
      };
      (mockR2.put as any).mockResolvedValueOnce(mockObject);

      await r2Put(mockR2 as R2Bucket, 'test.txt', 'content', 'text/plain');

      expect(mockObject.httpMetadata?.contentType).toBe('text/plain');
    });

    it('should handle stream as body', async () => {
      const mockObject = { key: 'test', size: 0, etag: '' };
      (mockR2.put as any).mockResolvedValueOnce(mockObject);
      const mockStream = {} as ReadableStream<Uint8Array>;

      await r2Put(mockR2 as R2Bucket, 'test', mockStream);

      expect(mockR2.put).toHaveBeenCalledWith('test', mockStream);
    });
  });

  describe('r2Get', () => {
    it('should get object from R2', async () => {
      const mockObject = { key: 'test.txt', size: 100, etag: 'abc123' };
      (mockR2.get as any).mockResolvedValueOnce(mockObject);

      const result = await r2Get(mockR2 as R2Bucket, 'test.txt');

      expect(result).toEqual(mockObject);
      expect(mockR2.get).toHaveBeenCalledWith('test.txt');
    });

    it('should return null when object not found', async () => {
      (mockR2.get as any).mockResolvedValueOnce(null);

      const result = await r2Get(mockR2 as R2Bucket, 'missing.txt');

      expect(result).toBeNull();
    });
  });

  describe('r2Delete', () => {
    it('should delete object from R2', async () => {
      await r2Delete(mockR2 as R2Bucket, 'test.txt');

      expect(mockR2.delete).toHaveBeenCalledWith('test.txt');
    });

    it('should handle multiple deletes', async () => {
      await r2Delete(mockR2 as R2Bucket, 'file1.txt');
      await r2Delete(mockR2 as R2Bucket, 'file2.txt');

      expect(mockR2.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('r2List', () => {
    it('should list objects with prefix', async () => {
      const objects = [
        { key: 'a.txt', size: 100, etag: '1' },
        { key: 'b.txt', size: 200, etag: '2' },
      ];
      (mockR2.list as any).mockResolvedValueOnce({
        objects,
        truncated: false,
      });

      const result = await r2List(mockR2 as R2Bucket, 'uploads/');

      expect(result).toEqual(objects);
      expect(mockR2.list).toHaveBeenCalledWith({ prefix: 'uploads/' });
    });

    it('should handle empty list', async () => {
      (mockR2.list as any).mockResolvedValueOnce({
        objects: [],
        truncated: false,
      });

      const result = await r2List(mockR2 as R2Bucket, 'prefix/');

      expect(result).toEqual([]);
    });

    it('should return all object keys', async () => {
      const objects = [
        { key: 'x.txt', size: 10, etag: '1' },
        { key: 'y.txt', size: 20, etag: '2' },
        { key: 'z.txt', size: 30, etag: '3' },
      ];
      (mockR2.list as any).mockResolvedValueOnce({
        objects,
        truncated: false,
      });

      const result = await r2List(mockR2 as R2Bucket, '');

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('x.txt');
    });
  });
});
