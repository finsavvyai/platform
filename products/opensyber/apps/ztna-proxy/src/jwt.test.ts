import { describe, it, expect } from 'vitest';
import { verifyBearer } from './jwt.js';

const SECRET = 'test-jwt-secret-32bytes-minimum-len-yes';

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function makeJwt(
  payload: Record<string, unknown>,
  secret = SECRET,
  alg: string = 'HS256',
): Promise<string> {
  const headerB64 = base64url(JSON.stringify({ alg, typ: 'JWT' }));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return `${headerB64}.${payloadB64}.${base64url(sig)}`;
}

describe('verifyBearer', () => {
  it('returns null when no Authorization header', async () => {
    expect(await verifyBearer(null, SECRET)).toBeNull();
  });

  it('returns null when scheme is not Bearer', async () => {
    expect(await verifyBearer('Basic abcdef', SECRET)).toBeNull();
  });

  it('accepts a valid JWT and extracts userId + sessionId', async () => {
    const token = await makeJwt({
      userId: 'u-42',
      sessionId: 'sess-9',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    const result = await verifyBearer(`Bearer ${token}`, SECRET);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('u-42');
    expect(result!.sessionId).toBe('sess-9');
  });

  it('falls back to sub when userId is absent', async () => {
    const token = await makeJwt({
      sub: 'user-from-sub',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    const result = await verifyBearer(`Bearer ${token}`, SECRET);
    expect(result?.userId).toBe('user-from-sub');
    expect(result?.sessionId).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const token = await makeJwt({
      userId: 'u-1',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    expect(await verifyBearer(`Bearer ${token}`, SECRET)).toBeNull();
  });

  it('rejects token signed with the wrong secret', async () => {
    const token = await makeJwt(
      { userId: 'u-1', exp: Math.floor(Date.now() / 1000) + 600 },
      'a-different-secret',
    );
    expect(await verifyBearer(`Bearer ${token}`, SECRET)).toBeNull();
  });

  it('rejects unsupported algorithms', async () => {
    const token = await makeJwt(
      { userId: 'u-1', exp: Math.floor(Date.now() / 1000) + 600 },
      SECRET,
      'none',
    );
    expect(await verifyBearer(`Bearer ${token}`, SECRET)).toBeNull();
  });

  it('rejects malformed tokens', async () => {
    expect(await verifyBearer('Bearer not.a.jwt-with-bad-structure', SECRET)).toBeNull();
    expect(await verifyBearer('Bearer one-part', SECRET)).toBeNull();
  });
});
