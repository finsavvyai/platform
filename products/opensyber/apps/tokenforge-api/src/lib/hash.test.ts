import { describe, it, expect } from 'vitest';
import { hashApiKey } from './hash.js';

describe('hashApiKey', () => {
  it('returns a hex-encoded SHA-256 hash', async () => {
    const hash = await hashApiKey('tf_testkey123');
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns consistent hash for same input', async () => {
    const hash1 = await hashApiKey('tf_mykey');
    const hash2 = await hashApiKey('tf_mykey');
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different input', async () => {
    const hash1 = await hashApiKey('tf_key_a');
    const hash2 = await hashApiKey('tf_key_b');
    expect(hash1).not.toBe(hash2);
  });

  it('matches the known-good SHA-256 hex of the empty string', async () => {
    // sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(await hashApiKey('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches the known-good SHA-256 hex of "abc"', async () => {
    // sha256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(await hashApiKey('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('output is exactly 64 hex chars (SHA-256 digest = 32 bytes = 64 hex)', async () => {
    const hash = await hashApiKey('any-input-of-any-length');
    expect(hash).toHaveLength(64);
  });

  it('output uses lowercase hex (no uppercase letters)', async () => {
    const hash = await hashApiKey('TEST_KEY_WITH_UPPER');
    expect(hash).toBe(hash.toLowerCase());
    expect(/[A-F]/.test(hash)).toBe(false);
  });

  it('handles unicode input by encoding to UTF-8 first', async () => {
    // sha256(utf8("hello 世界")) — non-ASCII must be normalized through TextEncoder
    const hash = await hashApiKey('hello 世界');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Different from ASCII variant
    expect(hash).not.toBe(await hashApiKey('hello world'));
  });
});
