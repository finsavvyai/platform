import { eq, and } from 'drizzle-orm';
import { credentials } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';
import { encrypt, decrypt, vaultAad } from '../utils/encryption.js';

type Db = DrizzleD1Database<typeof schema>;

export interface SecretEntry {
  id: string;
  key: string;
  createdAt: string;
}

export interface VaultService {
  storeSecret(opts: {
    db: Db;
    userId: string;
    instanceId: string;
    key: string;
    value: string;
    encryptionKey: string;
  }): Promise<SecretEntry>;

  listSecrets(opts: {
    db: Db;
    userId: string;
    instanceId: string;
  }): Promise<SecretEntry[]>;

  deleteSecret(opts: {
    db: Db;
    userId: string;
    instanceId: string;
    key: string;
  }): Promise<boolean>;

  getDecryptedSecrets(opts: {
    db: Db;
    instanceId: string;
    encryptionKey: string;
  }): Promise<Record<string, string>>;
}

export const vaultService: VaultService = {
  async storeSecret({ db, userId, instanceId, key, value, encryptionKey }) {
    // Delete existing secret with the same key (upsert behavior)
    await db
      .delete(credentials)
      .where(
        and(
          eq(credentials.userId, userId),
          eq(credentials.instanceId, instanceId),
          eq(credentials.key, key),
        ),
      );

    const encryptedValue = await encrypt(value, encryptionKey, vaultAad(userId, instanceId, key));
    const id = generateId();
    const now = new Date().toISOString();

    await db.insert(credentials).values({
      id,
      userId,
      instanceId,
      key,
      encryptedValue,
      createdAt: now,
    });

    return { id, key, createdAt: now };
  },

  async listSecrets({ db, userId, instanceId }) {
    const rows = await db
      .select({
        id: credentials.id,
        key: credentials.key,
        createdAt: credentials.createdAt,
      })
      .from(credentials)
      .where(
        and(
          eq(credentials.userId, userId),
          eq(credentials.instanceId, instanceId),
        ),
      );

    return rows;
  },

  async deleteSecret({ db, userId, instanceId, key }) {
    const result = await db
      .delete(credentials)
      .where(
        and(
          eq(credentials.userId, userId),
          eq(credentials.instanceId, instanceId),
          eq(credentials.key, key),
        ),
      ) as unknown as { rowsAffected?: number } | undefined;

    return ((result as { rowsAffected?: number })?.rowsAffected ?? 0) > 0;
  },

  async getDecryptedSecrets({ db, instanceId, encryptionKey }) {
    const rows = await db
      .select({
        userId: credentials.userId,
        key: credentials.key,
        encryptedValue: credentials.encryptedValue,
      })
      .from(credentials)
      .where(eq(credentials.instanceId, instanceId));

    const secrets: Record<string, string> = {};
    for (const row of rows) {
      // v2 ciphertext binds to AAD; legacy (v1) ciphertext ignores the
      // extra argument and decrypts via the original global-key path.
      const aad = vaultAad(row.userId, instanceId, row.key);
      secrets[row.key] = await decrypt(row.encryptedValue, encryptionKey, aad);
    }

    return secrets;
  },
};
