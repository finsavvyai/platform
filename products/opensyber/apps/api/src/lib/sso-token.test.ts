import { describe, it, expect } from 'vitest';
import { generateSsoToken } from './sso-token.js';

function base64urlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded);
}

describe('generateSsoToken', () => {
  const secret = 'test-secret-key-for-hmac-signing';

  it('returns a three-part JWT string', async () => {
    const token = await generateSsoToken('user_123', secret);
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  it('header declares HS256 algorithm', async () => {
    const token = await generateSsoToken('user_123', secret);
    const header = JSON.parse(base64urlDecode(token.split('.')[0]));
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
  });

  it('payload contains sub, iat, and exp claims', async () => {
    const token = await generateSsoToken('user_abc', secret);
    const payload = JSON.parse(base64urlDecode(token.split('.')[1]));
    expect(payload.sub).toBe('user_abc');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  it('exp is 24 hours after iat', async () => {
    const token = await generateSsoToken('user_abc', secret);
    const payload = JSON.parse(base64urlDecode(token.split('.')[1]));
    expect(payload.exp - payload.iat).toBe(86400);
  });

  it('signature verifies with the same secret', async () => {
    const token = await generateSsoToken('user_verify', secret);
    const [headerB64, payloadB64, sigB64] = token.split('.');
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
    expect(valid).toBe(true);
  });

  it('signature does not verify with a different secret', async () => {
    const token = await generateSsoToken('user_verify', secret);
    const [headerB64, payloadB64, sigB64] = token.split('.');
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    const wrongKey = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode('wrong-secret'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', wrongKey, sigBytes, data);
    expect(valid).toBe(false);
  });

  it('produces url-safe base64 (no +, /, or = characters)', async () => {
    // Generate several tokens to increase chance of catching encoding issues
    for (let i = 0; i < 5; i++) {
      const token = await generateSsoToken(`user_${i}`, secret);
      expect(token).not.toMatch(/[+/=]/);
    }
  });
});
