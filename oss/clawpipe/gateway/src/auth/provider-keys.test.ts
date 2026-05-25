/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptValue, decryptValue, storeProviderKey, readProviderKey, deleteProviderKey } from './provider-keys';
import type { Env } from '../types';

const SECRET = 'this-is-a-32-char-secret-abcdefgh';
const SHORT  = 'tooshort';

describe('encryptValue / decryptValue', () => {
  it('round-trips plaintext', async () => {
    const { ciphertextB64, nonceB64 } = await encryptValue('sk-test-key', SECRET);
    const plain = await decryptValue(ciphertextB64, nonceB64, SECRET);
    expect(plain).toBe('sk-test-key');
  });

  it('produces different ciphertext each call (random nonce)', async () => {
    const a = await encryptValue('same', SECRET);
    const b = await encryptValue('same', SECRET);
    expect(a.ciphertextB64).not.toBe(b.ciphertextB64);
    expect(a.nonceB64).not.toBe(b.nonceB64);
  });

  it('throws on wrong secret (AEAD tag mismatch)', async () => {
    const { ciphertextB64, nonceB64 } = await encryptValue('secret-val', SECRET);
    const wrongSecret = 'wrong-secret-also-32-chars-filler';
    await expect(decryptValue(ciphertextB64, nonceB64, wrongSecret)).rejects.toThrow();
  });

  it('throws on tampered ciphertext', async () => {
    const { ciphertextB64, nonceB64 } = await encryptValue('original', SECRET);
    const tampered = ciphertextB64.slice(0, -4) + 'AAAA';
    await expect(decryptValue(tampered, nonceB64, SECRET)).rejects.toThrow();
  });

  it('throws when secret is shorter than 32 chars on encrypt', async () => {
    await expect(encryptValue('val', SHORT)).rejects.toThrow('32 characters');
  });

  it('throws when secret is shorter than 32 chars on decrypt', async () => {
    const { ciphertextB64, nonceB64 } = await encryptValue('val', SECRET);
    await expect(decryptValue(ciphertextB64, nonceB64, SHORT)).rejects.toThrow('32 characters');
  });
});

describe('storeProviderKey / readProviderKey / deleteProviderKey', () => {
  let store: Record<string, { ciphertext_b64: string; nonce_b64: string }> = {};

  function makeEnv(secret: string | undefined): Env {
    return {
      PROVIDER_KEY_ENCRYPTION_SECRET: secret,
      DB: {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            run: async () => {
              if (sql.includes('INSERT INTO provider_keys')) {
                const key = `${args[0]}:${args[1]}`;
                store[key] = { ciphertext_b64: args[2] as string, nonce_b64: args[3] as string };
              } else if (sql.includes('DELETE FROM provider_keys')) {
                delete store[`${args[0]}:${args[1]}`];
              }
            },
            first: async <T>(): Promise<T | null> => {
              if (sql.includes('SELECT ciphertext_b64')) {
                const key = `${args[0]}:${args[1]}`;
                return (store[key] ?? null) as T | null;
              }
              return null;
            },
          }),
        }),
      },
    } as unknown as Env;
  }

  beforeEach(() => { store = {}; });

  it('stores and retrieves a key', async () => {
    const env = makeEnv(SECRET);
    await storeProviderKey(env, 'proj-1', 'openai', 'sk-real-key');
    const result = await readProviderKey(env, 'proj-1', 'openai');
    expect(result).toBe('sk-real-key');
  });

  it('returns null when key not stored', async () => {
    const env = makeEnv(SECRET);
    const result = await readProviderKey(env, 'proj-1', 'anthropic');
    expect(result).toBeNull();
  });

  it('returns null when PROVIDER_KEY_ENCRYPTION_SECRET is missing', async () => {
    const env = makeEnv(undefined);
    const result = await readProviderKey(env, 'proj-1', 'openai');
    expect(result).toBeNull();
  });

  it('throws clear error on store when secret is missing', async () => {
    const env = makeEnv(undefined);
    await expect(storeProviderKey(env, 'proj-1', 'openai', 'sk-x')).rejects.toThrow(
      'PROVIDER_KEY_ENCRYPTION_SECRET is not configured',
    );
  });

  it('deletes a key', async () => {
    const env = makeEnv(SECRET);
    await storeProviderKey(env, 'proj-1', 'openai', 'sk-real-key');
    await deleteProviderKey(env, 'proj-1', 'openai');
    const result = await readProviderKey(env, 'proj-1', 'openai');
    expect(result).toBeNull();
  });
});
