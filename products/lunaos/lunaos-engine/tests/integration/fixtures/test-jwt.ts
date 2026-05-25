/**
 * JWT helper for integration tests.
 *
 * Creates signed JWTs using Web Crypto HMAC-SHA256,
 * matching the engine's production JWT implementation.
 */

import { TEST_JWT_SECRET } from './test-env';

/**
 * Create a signed JWT for a test user.
 * Uses Web Crypto HMAC-SHA256 (same as engine worker.ts).
 */
export async function createTestJWT(
  userId: string,
  email: string,
  tier: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: userId,
    email,
    tier,
    iat: now,
    exp: now + 86400,
  };

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(TEST_JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signingInput}.${sigB64}`;
}
