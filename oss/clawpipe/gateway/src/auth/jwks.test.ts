/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { parseJwt, verifyIdToken } from './jwks';

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlStr(s: string): string {
  return b64url(new TextEncoder().encode(s));
}

/** Generate an RSA keypair + matching JWK (public) for tests. */
async function makeKeypair(): Promise<{ privateKey: CryptoKey; jwk: JsonWebKey }> {
  const kp = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  return { privateKey: kp.privateKey, jwk };
}

async function signJwt(privateKey: CryptoKey, header: object, payload: object): Promise<string> {
  const h = b64urlStr(JSON.stringify(header));
  const p = b64urlStr(JSON.stringify(payload));
  const input = new TextEncoder().encode(`${h}.${p}`);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, input);
  return `${h}.${p}.${b64url(sig)}`;
}

describe('parseJwt', () => {
  it('returns null for non-three-segment input', () => {
    expect(parseJwt('a.b')).toBeNull();
    expect(parseJwt('not.a.valid.jwt')).toBeNull();
  });

  it('parses header and payload from valid JWT shape', () => {
    const h = b64urlStr('{"alg":"RS256","kid":"x"}');
    const p = b64urlStr('{"sub":"u1","iss":"i"}');
    const sig = b64url(new Uint8Array([1, 2, 3]));
    const parsed = parseJwt(`${h}.${p}.${sig}`);
    expect(parsed?.header.alg).toBe('RS256');
    expect(parsed?.header.kid).toBe('x');
    expect(parsed?.payload.sub).toBe('u1');
  });

  it('returns null on malformed base64', () => {
    expect(parseJwt('!!!.!!!.!!!')).toBeNull();
  });
});

describe('verifyIdToken', () => {
  it('verifies a signed token with matching iss + aud', async () => {
    const { privateKey, jwk } = await makeKeypair();
    const kid = 'test-kid';
    const jwksUri = 'https://idp.test/jwks';
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (u: string) => {
      expect(u).toBe(jwksUri);
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid }] }), { status: 200 });
    }) as typeof fetch;
    try {
      const token = await signJwt(privateKey, { alg: 'RS256', kid }, {
        iss: 'https://idp.test', aud: 'client-1', sub: 'u1', exp: Math.floor(Date.now() / 1000) + 60,
      });
      const out = await verifyIdToken(token, jwksUri, 'https://idp.test', 'client-1');
      expect(out?.sub).toBe('u1');
    } finally { globalThis.fetch = origFetch; }
  });

  let _uriCounter = 0;
  const uniqueUri = () => `https://idp.test/jwks-${++_uriCounter}`;

  it('rejects expired tokens', async () => {
    const { privateKey, jwk } = await makeKeypair();
    const jwksUri = uniqueUri();
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k' }] }), { status: 200 })) as typeof fetch;
    try {
      const token = await signJwt(privateKey, { alg: 'RS256', kid: 'k' }, {
        iss: 'i', aud: 'a', sub: 'u', exp: Math.floor(Date.now() / 1000) - 120,
      });
      expect(await verifyIdToken(token, jwksUri, 'i', 'a')).toBeNull();
    } finally { globalThis.fetch = origFetch; }
  });

  it('tolerates 30s clock skew past exp', async () => {
    const { privateKey, jwk } = await makeKeypair();
    const jwksUri = uniqueUri();
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k' }] }), { status: 200 })) as typeof fetch;
    try {
      const token = await signJwt(privateKey, { alg: 'RS256', kid: 'k' }, {
        iss: 'i', aud: 'a', sub: 'u', exp: Math.floor(Date.now() / 1000) - 30,
      });
      const out = await verifyIdToken(token, jwksUri, 'i', 'a');
      expect(out?.sub).toBe('u');
    } finally { globalThis.fetch = origFetch; }
  });

  it('rejects tokens not yet valid (nbf in the future)', async () => {
    const { privateKey, jwk } = await makeKeypair();
    const jwksUri = uniqueUri();
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k' }] }), { status: 200 })) as typeof fetch;
    try {
      const token = await signJwt(privateKey, { alg: 'RS256', kid: 'k' }, {
        iss: 'i', aud: 'a', sub: 'u', nbf: Math.floor(Date.now() / 1000) + 600,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      expect(await verifyIdToken(token, jwksUri, 'i', 'a')).toBeNull();
    } finally { globalThis.fetch = origFetch; }
  });

  it('rejects wrong issuer', async () => {
    const { privateKey, jwk } = await makeKeypair();
    const jwksUri = uniqueUri();
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k' }] }), { status: 200 })) as typeof fetch;
    try {
      const token = await signJwt(privateKey, { alg: 'RS256', kid: 'k' }, {
        iss: 'wrong', aud: 'a', sub: 'u', exp: Math.floor(Date.now() / 1000) + 60,
      });
      expect(await verifyIdToken(token, jwksUri, 'right', 'a')).toBeNull();
    } finally { globalThis.fetch = origFetch; }
  });

  it('rejects wrong audience', async () => {
    const { privateKey, jwk } = await makeKeypair();
    const jwksUri = uniqueUri();
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k' }] }), { status: 200 })) as typeof fetch;
    try {
      const token = await signJwt(privateKey, { alg: 'RS256', kid: 'k' }, {
        iss: 'i', aud: 'wrong', sub: 'u', exp: Math.floor(Date.now() / 1000) + 60,
      });
      expect(await verifyIdToken(token, jwksUri, 'i', 'right')).toBeNull();
    } finally { globalThis.fetch = origFetch; }
  });

  it('rejects non-RS256 alg', async () => {
    const h = b64urlStr('{"alg":"HS256"}');
    const p = b64urlStr('{"sub":"u","iss":"i","aud":"a","exp":9999999999}');
    const token = `${h}.${p}.sig`;
    expect(await verifyIdToken(token, uniqueUri(), 'i', 'a')).toBeNull();
  });

  it('rejects tokens with tampered payload (signature fails)', async () => {
    const { privateKey, jwk } = await makeKeypair();
    const jwksUri = uniqueUri();
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k' }] }), { status: 200 })) as typeof fetch;
    try {
      const good = await signJwt(privateKey, { alg: 'RS256', kid: 'k' }, {
        iss: 'i', aud: 'a', sub: 'u', exp: Math.floor(Date.now() / 1000) + 60,
      });
      const parts = good.split('.');
      const tamperedPayload = b64urlStr('{"iss":"i","aud":"a","sub":"HACKER","exp":9999999999}');
      expect(await verifyIdToken(`${parts[0]}.${tamperedPayload}.${parts[2]}`, jwksUri, 'i', 'a')).toBeNull();
    } finally { globalThis.fetch = origFetch; }
  });
});
