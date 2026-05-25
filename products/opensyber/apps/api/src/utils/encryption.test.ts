import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, vaultAad } from './encryption.js';

const SECRET = 'test-key-32-chars-padded-00000000';

describe('encryption (v1 legacy global-key)', () => {
  it('roundtrips without AAD', async () => {
    const ct = await encrypt('hello world', SECRET);
    expect(ct).not.toContain('hello');
    expect(ct.startsWith('v2:')).toBe(false);
    const pt = await decrypt(ct, SECRET);
    expect(pt).toBe('hello world');
  });

  it('different IVs produce different ciphertexts for same plaintext', async () => {
    const a = await encrypt('same', SECRET);
    const b = await encrypt('same', SECRET);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with a wrong key', async () => {
    const ct = await encrypt('hello', SECRET);
    await expect(decrypt(ct, 'different-key-00000000000000000000')).rejects.toBeTruthy();
  });
});

describe('encryption (v2 AAD-bound)', () => {
  it('roundtrips with matching AAD', async () => {
    const aad = vaultAad('user_1', 'inst_1', 'API_KEY');
    const ct = await encrypt('secret-value', SECRET, aad);
    expect(ct.startsWith('v2:')).toBe(true);
    const pt = await decrypt(ct, SECRET, aad);
    expect(pt).toBe('secret-value');
  });

  it('rejects decrypt with wrong AAD (cross-tenant ciphertext theft is blocked)', async () => {
    const ctTenantA = await encrypt('s', SECRET, vaultAad('user_A', 'inst_1', 'K'));
    await expect(decrypt(ctTenantA, SECRET, vaultAad('user_B', 'inst_1', 'K'))).rejects.toBeTruthy();
  });

  it('rejects decrypt without AAD for v2 ciphertext', async () => {
    const ct = await encrypt('s', SECRET, 'context-x');
    await expect(decrypt(ct, SECRET)).rejects.toThrow(/AAD required/);
  });

  it('different contexts derive different subkeys (tamper-swap blocked)', async () => {
    const a = await encrypt('v', SECRET, 'ctx-A');
    const b = await encrypt('v', SECRET, 'ctx-B');
    await expect(decrypt(a, SECRET, 'ctx-B')).rejects.toBeTruthy();
    await expect(decrypt(b, SECRET, 'ctx-A')).rejects.toBeTruthy();
  });
});

describe('vaultAad', () => {
  it('builds canonical vault context', () => {
    expect(vaultAad('u1', 'i1', 'k1')).toBe('vault:u1:i1:k1');
  });
});
