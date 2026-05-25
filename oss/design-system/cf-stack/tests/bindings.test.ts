import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getD1, getKV, getR2 } from '../src/bindings';
import type { Context } from 'hono';

describe('bindings', () => {
  let mockContext: Partial<Context>;

  beforeEach(() => {
    mockContext = {
      env: {},
    };
  });

  describe('getD1', () => {
    it('should return D1 database from context', () => {
      const mockDB = { prepare: vi.fn() };
      mockContext.env = { MY_DB: mockDB };
      const result = getD1(mockContext as Context, 'MY_DB');
      expect(result).toBe(mockDB);
    });

    it('should throw error when database not found', () => {
      mockContext.env = {};
      expect(() => getD1(mockContext as Context, 'MY_DB')).toThrow(
        'D1 database "MY_DB" not found in Env',
      );
    });

    it('should throw error when env is undefined', () => {
      mockContext.env = undefined;
      expect(() => getD1(mockContext as Context, 'MY_DB')).toThrow();
    });
  });

  describe('getKV', () => {
    it('should return KV namespace from context', () => {
      const mockKV = { get: vi.fn(), put: vi.fn(), delete: vi.fn() };
      mockContext.env = { MY_KV: mockKV };
      const result = getKV(mockContext as Context, 'MY_KV');
      expect(result).toBe(mockKV);
    });

    it('should throw error when namespace not found', () => {
      mockContext.env = {};
      expect(() => getKV(mockContext as Context, 'MY_KV')).toThrow(
        'KV namespace "MY_KV" not found in Env',
      );
    });

    it('should throw error when env is undefined', () => {
      mockContext.env = undefined;
      expect(() => getKV(mockContext as Context, 'MY_KV')).toThrow();
    });
  });

  describe('getR2', () => {
    it('should return R2 bucket from context', () => {
      const mockR2 = { get: vi.fn(), put: vi.fn(), delete: vi.fn() };
      mockContext.env = { MY_R2: mockR2 };
      const result = getR2(mockContext as Context, 'MY_R2');
      expect(result).toBe(mockR2);
    });

    it('should throw error when bucket not found', () => {
      mockContext.env = {};
      expect(() => getR2(mockContext as Context, 'MY_R2')).toThrow(
        'R2 bucket "MY_R2" not found in Env',
      );
    });

    it('should throw error when env is undefined', () => {
      mockContext.env = undefined;
      expect(() => getR2(mockContext as Context, 'MY_R2')).toThrow();
    });
  });
});
