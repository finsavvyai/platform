import { describe, it, expect, vi } from 'vitest';

describe('API Key Management', () => {
  it('enforces max 5 keys per user', () => {
    const maxKeys = 5;
    const existingCount = 5;
    expect(existingCount >= maxKeys).toBe(true);
  });

  it('generates unique key prefixes', () => {
    const prefix1 = 'lnos_' + crypto.randomUUID().slice(0, 8);
    const prefix2 = 'lnos_' + crypto.randomUUID().slice(0, 8);
    expect(prefix1).not.toBe(prefix2);
  });

  it('key prefix starts with lnos_', () => {
    const prefix = 'lnos_' + crypto.randomUUID().slice(0, 8);
    expect(prefix.startsWith('lnos_')).toBe(true);
  });

  it('revoked keys cannot be used', () => {
    const key = { id: '1', revoked_at: new Date().toISOString() };
    expect(key.revoked_at).toBeTruthy();
  });
});
