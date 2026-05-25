import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb } from '../test/helpers.js';

vi.mock('../utils/encryption.js', () => ({
  encrypt: vi.fn(async (value: string) => `enc:${value}`),
  decrypt: vi.fn(async (ciphertext: string) => ciphertext.replace(/^enc:/, '')),
  vaultAad: vi.fn((userId: string, instanceId: string, key: string) => `vault:${userId}:${instanceId}:${key}`),
}));

import { vaultService } from './vault.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const mockEncrypt = encrypt as ReturnType<typeof vi.fn>;
const mockDecrypt = decrypt as ReturnType<typeof vi.fn>;

describe('vaultService', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  const BASE_OPTS = {
    userId: 'user_1',
    instanceId: 'inst_1',
    encryptionKey: 'test-key-32-chars-padded-00000000',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  // ─── storeSecret ──────────────────────────────────────────────────────────

  describe('storeSecret', () => {
    it('encrypts the value and inserts a new credential', async () => {
      const result = await vaultService.storeSecret({
        db: mockDb as any,
        ...BASE_OPTS,
        key: 'API_KEY',
        value: 'my-secret-value',
      });

      expect(mockEncrypt).toHaveBeenCalledWith('my-secret-value', BASE_OPTS.encryptionKey, 'vault:user_1:inst_1:API_KEY');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb._insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_1',
          instanceId: 'inst_1',
          key: 'API_KEY',
          encryptedValue: 'enc:my-secret-value',
        }),
      );
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.key).toBe('API_KEY');
      expect(result.createdAt).toBeDefined();
    });

    it('deletes existing record with same key before inserting (upsert)', async () => {
      await vaultService.storeSecret({
        db: mockDb as any,
        ...BASE_OPTS,
        key: 'DUPLICATE_KEY',
        value: 'new-value',
      });

      // delete must be called before insert
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb._deleteChain.where).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();

      const deleteCallOrder = (mockDb.delete as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
      const insertCallOrder = (mockDb.insert as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
      expect(deleteCallOrder).toBeLessThan(insertCallOrder);
    });

    it('returns a SecretEntry with the generated id and key', async () => {
      const result = await vaultService.storeSecret({
        db: mockDb as any,
        ...BASE_OPTS,
        key: 'MY_TOKEN',
        value: 'abc123',
      });

      expect(result.key).toBe('MY_TOKEN');
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
      expect(typeof result.createdAt).toBe('string');
      expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
    });

    it('propagates encryption errors', async () => {
      mockEncrypt.mockRejectedValueOnce(new Error('Encryption failed'));

      await expect(
        vaultService.storeSecret({
          db: mockDb as any,
          ...BASE_OPTS,
          key: 'FAIL_KEY',
          value: 'value',
        }),
      ).rejects.toThrow('Encryption failed');
    });
  });

  // ─── listSecrets ──────────────────────────────────────────────────────────

  describe('listSecrets', () => {
    it('returns id, key, and createdAt — never the encrypted value', async () => {
      const rows = [
        { id: 'cred_1', key: 'DB_PASS', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'cred_2', key: 'API_KEY', createdAt: '2026-01-02T00:00:00.000Z' },
      ];
      mockDb._setSelectResult(rows);

      const result = await vaultService.listSecrets({
        db: mockDb as any,
        userId: 'user_1',
        instanceId: 'inst_1',
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'cred_1', key: 'DB_PASS', createdAt: '2026-01-01T00:00:00.000Z' });
      expect(result[1]).toEqual({ id: 'cred_2', key: 'API_KEY', createdAt: '2026-01-02T00:00:00.000Z' });
      // encrypted value must not be present in any row
      for (const row of result) {
        expect(row).not.toHaveProperty('encryptedValue');
      }
    });

    it('returns empty array when no secrets exist', async () => {
      mockDb._setSelectResult([]);

      const result = await vaultService.listSecrets({
        db: mockDb as any,
        userId: 'user_1',
        instanceId: 'inst_1',
      });

      expect(result).toEqual([]);
    });

    it('scopes query to the given userId and instanceId', async () => {
      mockDb._setSelectResult([]);

      await vaultService.listSecrets({
        db: mockDb as any,
        userId: 'user_scoped',
        instanceId: 'inst_scoped',
      });

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  // ─── deleteSecret ─────────────────────────────────────────────────────────

  describe('deleteSecret', () => {
    it('returns true when a row is deleted', async () => {
      mockDb._deleteChain.where.mockResolvedValueOnce({ rowsAffected: 1 });

      const result = await vaultService.deleteSecret({
        db: mockDb as any,
        userId: 'user_1',
        instanceId: 'inst_1',
        key: 'API_KEY',
      });

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('returns false when no rows are deleted (key not found)', async () => {
      mockDb._deleteChain.where.mockResolvedValueOnce({ rowsAffected: 0 });

      const result = await vaultService.deleteSecret({
        db: mockDb as any,
        userId: 'user_1',
        instanceId: 'inst_1',
        key: 'NONEXISTENT_KEY',
      });

      expect(result).toBe(false);
    });

    it('returns false when result is undefined (null-safe)', async () => {
      mockDb._deleteChain.where.mockResolvedValueOnce(undefined);

      const result = await vaultService.deleteSecret({
        db: mockDb as any,
        userId: 'user_1',
        instanceId: 'inst_1',
        key: 'ANY_KEY',
      });

      expect(result).toBe(false);
    });
  });

  // ─── getDecryptedSecrets ──────────────────────────────────────────────────

  describe('getDecryptedSecrets', () => {
    it('decrypts all secrets and returns a key-value map', async () => {
      mockDb._setSelectResult([
        { userId: 'user_1', key: 'DB_PASS', encryptedValue: 'enc:super-secret' },
        { userId: 'user_1', key: 'API_KEY', encryptedValue: 'enc:my-api-key' },
      ]);

      const result = await vaultService.getDecryptedSecrets({
        db: mockDb as any,
        instanceId: 'inst_1',
        encryptionKey: BASE_OPTS.encryptionKey,
      });

      expect(result).toEqual({ DB_PASS: 'super-secret', API_KEY: 'my-api-key' });
      expect(mockDecrypt).toHaveBeenCalledTimes(2);
      expect(mockDecrypt).toHaveBeenCalledWith('enc:super-secret', BASE_OPTS.encryptionKey, 'vault:user_1:inst_1:DB_PASS');
      expect(mockDecrypt).toHaveBeenCalledWith('enc:my-api-key', BASE_OPTS.encryptionKey, 'vault:user_1:inst_1:API_KEY');
    });

    it('returns an empty object when no secrets are stored', async () => {
      mockDb._setSelectResult([]);

      const result = await vaultService.getDecryptedSecrets({
        db: mockDb as any,
        instanceId: 'inst_1',
        encryptionKey: BASE_OPTS.encryptionKey,
      });

      expect(result).toEqual({});
      expect(mockDecrypt).not.toHaveBeenCalled();
    });

    it('propagates decryption errors', async () => {
      mockDb._setSelectResult([{ userId: 'user_1', key: 'BAD', encryptedValue: 'corrupted' }]);
      mockDecrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      await expect(
        vaultService.getDecryptedSecrets({
          db: mockDb as any,
          instanceId: 'inst_1',
          encryptionKey: BASE_OPTS.encryptionKey,
        }),
      ).rejects.toThrow('Decryption failed');
    });
  });
});
