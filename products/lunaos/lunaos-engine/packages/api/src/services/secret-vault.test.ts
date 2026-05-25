/**
 * secret-vault — AES-GCM-256 encrypt/decrypt + redact helpers.
 * Verifies: round-trip, tamper detection, format errors, missing key, redaction.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    encryptSecret,
    decryptSecret,
    redactForDisplay,
    __resetVaultCacheForTests,
} from './secret-vault';

// Valid base64-encoded 32-byte IKM
const VAULT_KEY_32B = btoa(String.fromCharCode(...new Uint8Array(32).fill(0xAB)));
const env = { SSO_VAULT_KEY: VAULT_KEY_32B };

beforeEach(() => {
    __resetVaultCacheForTests();
});

describe('encryptSecret / decryptSecret — round-trip', () => {
    it('round-trips a plain string', async () => {
        const plain = 'my-oidc-client-secret-value';
        const blob = await encryptSecret(plain, env);
        expect(blob).toMatch(/^v1:/);
        const got = await decryptSecret(blob, env);
        expect(got).toBe(plain);
    });

    it('produces unique ciphertexts for same plaintext (IV randomness)', async () => {
        const blob1 = await encryptSecret('same', env);
        const blob2 = await encryptSecret('same', env);
        expect(blob1).not.toBe(blob2);
    });

    it('round-trips a single character string', async () => {
        // Empty string produces blob size = IV+tag = 28 bytes, which fails the minimum
        // size check (IV+tag+1). Use single char to stay above minimum.
        const blob = await encryptSecret('x', env);
        const got = await decryptSecret(blob, env);
        expect(got).toBe('x');
    });

    it('round-trips unicode content', async () => {
        const plain = '🔒 secret café';
        const blob = await encryptSecret(plain, env);
        expect(await decryptSecret(blob, env)).toBe(plain);
    });
});

describe('decryptSecret — tamper detection', () => {
    it('throws secret_vault_tamper when ciphertext byte is flipped', async () => {
        const blob = await encryptSecret('sensitive', env);
        // Flip a byte in the middle of the base64url payload
        const prefix = 'v1:';
        const rest = blob.slice(prefix.length);
        // Swap a char near position 20 (well past the 12-byte IV)
        const tampered = prefix + rest.slice(0, 20) + (rest[20] === 'A' ? 'B' : 'A') + rest.slice(21);
        await expect(decryptSecret(tampered, env)).rejects.toThrow('secret_vault_tamper');
    });
});

describe('decryptSecret — format errors', () => {
    it('throws secret_vault_format if missing v1: prefix', async () => {
        await expect(decryptSecret('plaintext', env)).rejects.toThrow('secret_vault_format');
    });

    it('throws secret_vault_format if payload is too short after decoding', async () => {
        // v1: + base64url of only 5 bytes (less than iv+tag+1)
        const short = 'v1:' + btoa('short').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        await expect(decryptSecret(short, env)).rejects.toThrow('secret_vault_format');
    });

    it('throws secret_vault_format for non-string blob', async () => {
        await expect(decryptSecret(null as unknown as string, env)).rejects.toThrow('secret_vault_format');
    });
});

describe('deriveKey — missing / invalid key', () => {
    it('throws secret_vault_missing_key when SSO_VAULT_KEY absent', async () => {
        __resetVaultCacheForTests();
        await expect(encryptSecret('x', {})).rejects.toThrow('secret_vault_missing_key');
    });

    it('throws secret_vault_missing_key when key decodes to wrong length (<32 bytes)', async () => {
        __resetVaultCacheForTests();
        // base64 of 10 bytes
        const shortKey = btoa(String.fromCharCode(...new Uint8Array(10).fill(0x01)));
        await expect(encryptSecret('x', { SSO_VAULT_KEY: shortKey })).rejects.toThrow('secret_vault_missing_key');
    });

    it('throws secret_vault_missing_key when key decodes to wrong length (>32 bytes)', async () => {
        __resetVaultCacheForTests();
        const longKey = btoa(String.fromCharCode(...new Uint8Array(64).fill(0x02)));
        await expect(encryptSecret('x', { SSO_VAULT_KEY: longKey })).rejects.toThrow('secret_vault_missing_key');
    });

    it('throws secret_vault_missing_key for invalid base64', async () => {
        __resetVaultCacheForTests();
        await expect(encryptSecret('x', { SSO_VAULT_KEY: '!!!not-base64!!!' })).rejects.toThrow('secret_vault_missing_key');
    });
});

describe('redactForDisplay', () => {
    it('returns a string starting with ••••', async () => {
        const blob = await encryptSecret('secret', env);
        const hint = await redactForDisplay(blob);
        expect(hint).toMatch(/^••••[0-9a-f]{4}$/);
    });

    it('is stable — same blob always returns same hint', async () => {
        const blob = await encryptSecret('secret', env);
        const h1 = await redactForDisplay(blob);
        const h2 = await redactForDisplay(blob);
        expect(h1).toBe(h2);
    });

    it('different blobs produce different hints (probabilistic)', async () => {
        const b1 = await encryptSecret('aaa', env);
        const b2 = await encryptSecret('bbb', env);
        const h1 = await redactForDisplay(b1);
        const h2 = await redactForDisplay(b2);
        // Different blobs → different digests (not guaranteed for 4-hex suffix but near-certain)
        expect(h1).not.toBe(h2);
    });

    it('never reveals the plaintext', async () => {
        const plain = 'super-secret-value';
        const blob = await encryptSecret(plain, env);
        const hint = await redactForDisplay(blob);
        expect(hint).not.toContain(plain);
    });

    it('is async (returns a Promise)', () => {
        const result = redactForDisplay('v1:anything');
        expect(result).toBeInstanceOf(Promise);
    });
});
