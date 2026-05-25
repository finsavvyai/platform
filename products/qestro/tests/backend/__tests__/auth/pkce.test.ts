/**
 * PKCE utility unit tests.
 *
 * Covers: verifier generation, challenge derivation, round-trip S256 verification,
 * and edge behaviours that would break silently (wrong character set, wrong hash).
 *
 * All crypto runs with the Node 18+ globalThis.crypto Web Crypto API — same
 * environment the Workers runtime uses.
 */
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCE,
} from '../../../../backend/src/auth/pkce';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Re-implement S256 for test-independent verification. */
async function s256(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Regexp that matches base64url: A-Z a-z 0-9 - _ (no padding). */
const BASE64URL = /^[A-Za-z0-9\-_]+$/;

// ---------------------------------------------------------------------------
// generateCodeVerifier
// ---------------------------------------------------------------------------

describe('generateCodeVerifier', () => {
  it('produces a base64url-encoded string with no padding characters', () => {
    const v = generateCodeVerifier();
    expect(BASE64URL.test(v)).toBe(true);
    expect(v).not.toContain('+');
    expect(v).not.toContain('/');
    expect(v).not.toContain('=');
  });

  it('length is between 43 and 128 chars (RFC 7636 §4.1)', () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
  });

  it('produces unique values across consecutive calls', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// generateCodeChallenge
// ---------------------------------------------------------------------------

describe('generateCodeChallenge', () => {
  it('returns the S256 challenge for a known verifier', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const expected = await s256(verifier);
    expect(challenge).toBe(expected);
  });

  it('challenge is base64url-encoded (no +, /, =)', async () => {
    const challenge = await generateCodeChallenge(generateCodeVerifier());
    expect(BASE64URL.test(challenge)).toBe(true);
  });

  it('different verifiers produce different challenges', async () => {
    const a = await generateCodeChallenge(generateCodeVerifier());
    const b = await generateCodeChallenge(generateCodeVerifier());
    expect(a).not.toBe(b);
  });

  it('same verifier always produces the same challenge (deterministic)', async () => {
    const v = generateCodeVerifier();
    const c1 = await generateCodeChallenge(v);
    const c2 = await generateCodeChallenge(v);
    expect(c1).toBe(c2);
  });
});

// ---------------------------------------------------------------------------
// generatePKCE (pair)
// ---------------------------------------------------------------------------

describe('generatePKCE', () => {
  it('returns an object with codeVerifier, codeChallenge, and codeChallengeMethod', async () => {
    const pair = await generatePKCE();
    expect(typeof pair.codeVerifier).toBe('string');
    expect(typeof pair.codeChallenge).toBe('string');
    expect(pair.codeChallengeMethod).toBe('S256');
  });

  it('challenge matches S256(verifier) independently', async () => {
    const pair = await generatePKCE();
    const expected = await s256(pair.codeVerifier);
    expect(pair.codeChallenge).toBe(expected);
  });

  it('verifier and challenge differ (challenge is not just a copy)', async () => {
    const pair = await generatePKCE();
    expect(pair.codeVerifier).not.toBe(pair.codeChallenge);
  });

  it('consecutive pairs are unique (no verifier reuse)', async () => {
    const a = await generatePKCE();
    const b = await generatePKCE();
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
    expect(a.codeChallenge).not.toBe(b.codeChallenge);
  });
});
