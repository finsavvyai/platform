import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { verifyOidcIdToken, type JwksKey } from './oidc-verify.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return Buffer.from(bin, 'binary').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buildSignedJwt(
  alg: 'RS256' | 'ES256',
  payload: Record<string, unknown>,
  kid: string,
): Promise<{ jwt: string; jwk: JsonWebKey }> {
  const algoGen = alg === 'RS256'
    ? { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
    : { name: 'ECDSA', namedCurve: 'P-256' };
  const algoSign = alg === 'RS256'
    ? { name: 'RSASSA-PKCS1-v1_5' }
    : { name: 'ECDSA', hash: 'SHA-256' };
  const pair = await subtle.generateKey(algoGen, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', pair.publicKey);
  const headerB64 = b64url(JSON.stringify({ alg, typ: 'JWT', kid }));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = new Uint8Array(await subtle.sign(algoSign, pair.privateKey, signingInput));
  return { jwt: `${headerB64}.${payloadB64}.${b64url(sig)}`, jwk };
}

function jwkToJwksKey(jwk: JsonWebKey, kid: string): JwksKey {
  return {
    kid,
    kty: jwk.kty as 'RSA' | 'EC',
    alg: jwk.alg,
    use: jwk.use,
    n: jwk.n, e: jwk.e,
    crv: jwk.crv, x: jwk.x, y: jwk.y,
  };
}

const baseClaims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://acme.okta.com/oauth2/default',
  sub: 'user-1',
  aud: 'tf-app-1',
  iat: Math.floor(Date.now() / 1000) - 30,
  exp: Math.floor(Date.now() / 1000) + 600,
  ...overrides,
});

describe('verifyOidcIdToken', () => {
  it('verifies a valid RS256 token', async () => {
    const { jwt, jwk } = await buildSignedJwt('RS256', baseClaims(), 'kid-1');
    const result = await verifyOidcIdToken(jwt, {
      expectedIssuer: 'https://acme.okta.com/oauth2/default',
      expectedAudience: 'tf-app-1',
      jwks: { keys: [jwkToJwksKey(jwk, 'kid-1')] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.claims.sub).toBe('user-1');
  });

  it('verifies a valid ES256 token', async () => {
    const { jwt, jwk } = await buildSignedJwt('ES256', baseClaims(), 'kid-2');
    const result = await verifyOidcIdToken(jwt, {
      expectedIssuer: 'https://acme.okta.com/oauth2/default',
      expectedAudience: 'tf-app-1',
      jwks: { keys: [jwkToJwksKey(jwk, 'kid-2')] },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects when kid is not in JWKS', async () => {
    const { jwt, jwk } = await buildSignedJwt('RS256', baseClaims(), 'kid-x');
    const result = await verifyOidcIdToken(jwt, {
      expectedIssuer: 'https://acme.okta.com/oauth2/default',
      expectedAudience: 'tf-app-1',
      jwks: { keys: [jwkToJwksKey(jwk, 'different-kid')] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('jwks_kid_not_found');
  });

  it('rejects when issuer does not match', async () => {
    const { jwt, jwk } = await buildSignedJwt('RS256', baseClaims({ iss: 'https://evil.example.com' }), 'kid-1');
    const result = await verifyOidcIdToken(jwt, {
      expectedIssuer: 'https://acme.okta.com/oauth2/default',
      expectedAudience: 'tf-app-1',
      jwks: { keys: [jwkToJwksKey(jwk, 'kid-1')] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('iss_mismatch');
  });

  it('rejects when audience does not match', async () => {
    const { jwt, jwk } = await buildSignedJwt('RS256', baseClaims({ aud: 'other-app' }), 'kid-1');
    const result = await verifyOidcIdToken(jwt, {
      expectedIssuer: 'https://acme.okta.com/oauth2/default',
      expectedAudience: 'tf-app-1',
      jwks: { keys: [jwkToJwksKey(jwk, 'kid-1')] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('aud_mismatch');
  });

  it('accepts aud as an array containing the expected value', async () => {
    const { jwt, jwk } = await buildSignedJwt('RS256', baseClaims({ aud: ['other-app', 'tf-app-1'] }), 'kid-1');
    const result = await verifyOidcIdToken(jwt, {
      expectedIssuer: 'https://acme.okta.com/oauth2/default',
      expectedAudience: 'tf-app-1',
      jwks: { keys: [jwkToJwksKey(jwk, 'kid-1')] },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects expired tokens beyond skew', async () => {
    const past = Math.floor(Date.now() / 1000) - 1_000;
    const { jwt, jwk } = await buildSignedJwt('RS256', baseClaims({ iat: past - 10, exp: past }), 'kid-1');
    const result = await verifyOidcIdToken(jwt, {
      expectedIssuer: 'https://acme.okta.com/oauth2/default',
      expectedAudience: 'tf-app-1',
      jwks: { keys: [jwkToJwksKey(jwk, 'kid-1')] },
      clockSkewSeconds: 60,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('jwt_expired');
  });

  it('rejects tokens signed with a different key', async () => {
    const { jwt } = await buildSignedJwt('RS256', baseClaims(), 'kid-1');
    const { jwk: otherKey } = await buildSignedJwt('RS256', baseClaims(), 'kid-1');
    const result = await verifyOidcIdToken(jwt, {
      expectedIssuer: 'https://acme.okta.com/oauth2/default',
      expectedAudience: 'tf-app-1',
      jwks: { keys: [jwkToJwksKey(otherKey, 'kid-1')] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('jwt_bad_signature');
  });

  it('rejects unsupported alg (none)', async () => {
    const headerB64 = b64url(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'k1' }));
    const payloadB64 = b64url(JSON.stringify(baseClaims()));
    const result = await verifyOidcIdToken(`${headerB64}.${payloadB64}.`, {
      expectedIssuer: 'https://acme.okta.com/oauth2/default',
      expectedAudience: 'tf-app-1',
      jwks: { keys: [] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('jwt_unsupported_alg');
  });

  const ISS = 'https://acme.okta.com/oauth2/default';
  const AUD = 'tf-app-1';
  const expectReason = async (jwt: string, jwks: { keys: JwksKey[] }, reason: string) => {
    const r = await verifyOidcIdToken(jwt, { expectedIssuer: ISS, expectedAudience: AUD, jwks });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
  };

  it('rejects when JWT does not have 3 dot-separated parts (jwt_malformed)', async () => {
    await expectReason('not.a.full-jwt-extra.parts', { keys: [] }, 'jwt_malformed');
  });

  it('rejects when header/payload JSON is corrupt (jwt_malformed)', async () => {
    await expectReason('not-base64.not-base64.sig', { keys: [] }, 'jwt_malformed');
  });

  it('rejects when header has no kid claim (jwt_missing_kid)', async () => {
    const h = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const p = b64url(JSON.stringify(baseClaims()));
    await expectReason(`${h}.${p}.x`, { keys: [] }, 'jwt_missing_kid');
  });

  it('rejects tokens with iat far in the future (jwt_future_iat)', async () => {
    const future = Math.floor(Date.now() / 1000) + 7200;
    const { jwt, jwk } = await buildSignedJwt('RS256', baseClaims({ iat: future, exp: future + 600 }), 'kf');
    await expectReason(jwt, { keys: [jwkToJwksKey(jwk, 'kf')] }, 'jwt_future_iat');
  });

  it('rejects tokens whose nbf is in the future (jwt_not_yet_valid)', async () => {
    const nbf = Math.floor(Date.now() / 1000) + 7200;
    const { jwt, jwk } = await buildSignedJwt('RS256', baseClaims({ nbf }), 'kn');
    await expectReason(jwt, { keys: [jwkToJwksKey(jwk, 'kn')] }, 'jwt_not_yet_valid');
  });

  it('jwks_bad_key: importJwk catch fires when JWK shape is broken (RSA missing n)', async () => {
    const { jwt, jwk } = await buildSignedJwt('RS256', baseClaims(), 'kbad');
    await expectReason(jwt, { keys: [{ ...jwkToJwksKey(jwk, 'kbad'), n: undefined }] }, 'jwks_bad_key');
  });
  it('jwt_bad_signature: base64UrlToBytes catch fires on invalid b64 chars in signature segment', async () => {
    const { jwt, jwk } = await buildSignedJwt('RS256', baseClaims(), 'kx');
    const [h, p] = jwt.split('.');
    await expectReason(`${h}.${p}.@@@bad@@@`, { keys: [jwkToJwksKey(jwk, 'kx')] }, 'jwt_bad_signature');
  });
});
