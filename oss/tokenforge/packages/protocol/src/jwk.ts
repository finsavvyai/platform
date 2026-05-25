/**
 * JWK ↔ CryptoKey converters for ES256 (ECDSA P-256).
 *
 * `importJwkPublic` and `importJwkPrivate` accept JWK objects (not the
 * stringified form `importPublicKey` in ./crypto.ts handles); they are
 * used inside the Worker when a session record carries a parsed JWK
 * column directly from D1.
 *
 * Public-key handles are non-extractable. Private-key handles default
 * to non-extractable as well — pass `extractable: true` only when the
 * caller will round-trip the key back to JWK (rare; mostly for tests).
 */

const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;

export async function importJwkPublic(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ALG, false, ['verify']);
}

export async function importJwkPrivate(
  jwk: JsonWebKey,
  opts: { extractable?: boolean } = {},
): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ALG, opts.extractable ?? false, ['sign']);
}

export async function exportJwkPublic(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key) as Promise<JsonWebKey>;
}

export async function exportJwkPrivate(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key) as Promise<JsonWebKey>;
}

export async function generateKeyPair(opts: { extractable?: boolean } = {}): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ALG, opts.extractable ?? true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
}

/** Compact public-key thumbprint (SHA-256 over canonical JWK JSON), base64url. */
export async function publicKeyThumbprint(jwk: JsonWebKey): Promise<string> {
  const canon = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon) as BufferSource);
  return base64Url(new Uint8Array(buf));
}

function base64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
