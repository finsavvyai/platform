import { describe, it, expect, beforeEach } from 'vitest';
import { createMockKV } from '../test/helpers.js';
import { createMockDb } from '../test/mock-db.js';
import {
  tenantKvKey,
  tenantKvGet,
  tenantKvPut,
  tenantKvDelete,
  validateTenantScope,
  extractTenantId,
} from './tenant-isolation.js';

describe('Tenant Isolation Middleware', () => {
  let mockKv: KVNamespace;
  let mockDb: any;

  beforeEach(() => {
    mockKv = createMockKV();
    mockDb = createMockDb();
  });

  describe('tenantKvKey', () => {
    it('should prefix key correctly with tenant ID', () => {
      const key = tenantKvKey('user-123', 'github', 'token');

      expect(key).toBe('tenant:user-123:credentials:github:token');
    });

    it('should handle different integration slugs', () => {
      const gitlabKey = tenantKvKey('user-456', 'gitlab', 'api-key');
      const slackKey = tenantKvKey('user-456', 'slack', 'webhook');

      expect(gitlabKey).toContain('gitlab');
      expect(slackKey).toContain('slack');
    });

    it('should preserve key names exactly', () => {
      const key1 = tenantKvKey('user-1', 'integ', 'my-secret-token');
      const key2 = tenantKvKey('user-1', 'integ', 'other-key');

      expect(key1).toContain('my-secret-token');
      expect(key2).toContain('other-key');
    });

    it('should handle special characters in tenant ID', () => {
      const key = tenantKvKey('user+special@domain', 'github', 'token');

      expect(key).toContain('user+special@domain');
    });

    it('should handle UUID-format tenant IDs', () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const key = tenantKvKey(tenantId, 'github', 'secret');

      expect(key).toContain(tenantId);
    });

    it('should create consistent keys for same inputs', () => {
      const key1 = tenantKvKey('user-123', 'slack', 'token');
      const key2 = tenantKvKey('user-123', 'slack', 'token');

      expect(key1).toBe(key2);
    });

    it('should differentiate keys for different users', () => {
      const key1 = tenantKvKey('user-1', 'github', 'token');
      const key2 = tenantKvKey('user-2', 'github', 'token');

      expect(key1).not.toBe(key2);
    });

    it('should differentiate keys for different integrations', () => {
      const key1 = tenantKvKey('user-1', 'github', 'token');
      const key2 = tenantKvKey('user-1', 'gitlab', 'token');

      expect(key1).not.toBe(key2);
    });
  });

  describe('tenantKvGet', () => {
    it('should construct and call KV get with correct key', async () => {
      (mockKv.get as any).mockResolvedValueOnce('secret-value');

      const value = await tenantKvGet(mockKv, 'user-123', 'github', 'token');

      expect(mockKv.get).toHaveBeenCalledWith('tenant:user-123:credentials:github:token');
      expect(value).toBe('secret-value');
    });

    it('should return null when key not found', async () => {
      (mockKv.get as any).mockResolvedValueOnce(null);

      const value = await tenantKvGet(mockKv, 'user-123', 'github', 'token');

      expect(value).toBeNull();
    });

    it('should isolate data by user', async () => {
      (mockKv.get as any).mockResolvedValueOnce('secret-1');

      await tenantKvGet(mockKv, 'user-1', 'github', 'token');

      const firstCall = (mockKv.get as any).mock.calls[0][0];
      expect(firstCall).toContain('user-1');
    });
  });

  describe('tenantKvPut', () => {
    it('should construct and call KV put with correct key', async () => {
      await tenantKvPut(mockKv, 'user-123', 'github', 'token', 'secret-value');

      expect(mockKv.put).toHaveBeenCalledWith(
        'tenant:user-123:credentials:github:token',
        'secret-value',
        { expirationTtl: undefined },
      );
    });

    it('should support TTL parameter', async () => {
      await tenantKvPut(mockKv, 'user-123', 'github', 'token', 'secret', 3600);

      expect(mockKv.put).toHaveBeenCalledWith(
        'tenant:user-123:credentials:github:token',
        'secret',
        { expirationTtl: 3600 },
      );
    });

    it('should isolate writes by user', async () => {
      await tenantKvPut(mockKv, 'user-1', 'slack', 'webhook', 'value1');
      await tenantKvPut(mockKv, 'user-2', 'slack', 'webhook', 'value2');

      expect(mockKv.put).toHaveBeenCalledTimes(2);
      const calls = (mockKv.put as any).mock.calls;
      expect(calls[0][0]).toContain('user-1');
      expect(calls[1][0]).toContain('user-2');
    });

    it('should write to different integration namespaces', async () => {
      await tenantKvPut(mockKv, 'user-123', 'github', 'token', 'github-secret');
      await tenantKvPut(mockKv, 'user-123', 'gitlab', 'token', 'gitlab-secret');

      const calls = (mockKv.put as any).mock.calls;
      expect(calls[0][0]).toContain('github');
      expect(calls[1][0]).toContain('gitlab');
    });
  });

  describe('tenantKvDelete', () => {
    it('should construct and call KV delete with correct key', async () => {
      await tenantKvDelete(mockKv, 'user-123', 'github', 'token');

      expect(mockKv.delete).toHaveBeenCalledWith(
        'tenant:user-123:credentials:github:token',
      );
    });

    it('should isolate deletes by user', async () => {
      await tenantKvDelete(mockKv, 'user-1', 'github', 'token');
      await tenantKvDelete(mockKv, 'user-2', 'github', 'token');

      const calls = (mockKv.delete as any).mock.calls;
      expect(calls[0][0]).toContain('user-1');
      expect(calls[1][0]).toContain('user-2');
    });

    it('should delete from correct integration namespace', async () => {
      await tenantKvDelete(mockKv, 'user-123', 'slack', 'webhook');

      const calls = (mockKv.delete as any).mock.calls;
      expect(calls[0][0]).toContain('slack');
    });
  });

});

/**
 * Helper function: construct tenant-isolated KV key
 */
function tenantKvKey(userId: string, slug: string, key: string): string {
  return `tenant:${userId}:credentials:${slug}:${key}`;
}
