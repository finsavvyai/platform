/** JWKS-based JWT verification for OIDC id_tokens (RS256). */

interface Jwk {
  kty: string; kid?: string; alg?: string; use?: string;
  n?: string; e?: string;
}

interface Jwt {
  header: { alg: string; kid?: string; typ?: string };
  payload: Record<string, unknown>;
  signature: Uint8Array;
  signingInput: string;
}

/** Per-isolate cache of keys by JWKS URI. */
const _keyCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();
const CACHE_TTL_MS = 3_600_000;

function b64urlToBytes(b64: string): Uint8Array {
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 === 0 ? norm : norm + '='.repeat(4 - (norm.length % 4));
  const binary = atob(pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function b64urlToString(b64: string): string {
  return new TextDecoder().decode(b64urlToBytes(b64));
}

/** Parse a compact JWS string into its three components + signing input. */
export function parseJwt(token: string): Jwt | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(b64urlToString(parts[0]));
    const payload = JSON.parse(b64urlToString(parts[1]));
    const signature = b64urlToBytes(parts[2]);
    return { header, payload, signature, signingInput: `${parts[0]}.${parts[1]}` };
  } catch {
    return null;
  }
}

/** Fetch JWKS doc; respect 1h cache. */
async function getKeys(jwksUri: string): Promise<Jwk[]> {
  const cached = _keyCache.get(jwksUri);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.keys;
  const res = await fetch(jwksUri);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = await res.json() as { keys: Jwk[] };
  _keyCache.set(jwksUri, { keys: body.keys ?? [], fetchedAt: Date.now() });
  return body.keys ?? [];
}

/** Import an RSA JWK as a verifying CryptoKey. */
async function importRsaKey(jwk: Jwk): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true } as JsonWebKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

/**
 * Verify a JWT's signature + iss/aud/exp claims using the JWKS URI.
 * Returns payload on success, null otherwise. RS256 only.
 */
export async function verifyIdToken(
  token: string, jwksUri: string, expectedIssuer: string, expectedAudience: string,
): Promise<Record<string, unknown> | null> {
  const jwt = parseJwt(token);
  if (!jwt) return null;
  if (jwt.header.alg !== 'RS256') return null;

  const keys = await getKeys(jwksUri);
  const match = jwt.header.kid
    ? keys.find((k) => k.kid === jwt.header.kid)
    : keys.find((k) => k.kty === 'RSA');
  if (!match?.n || !match?.e) return null;

  const cryptoKey = await importRsaKey(match);
  const input = new TextEncoder().encode(jwt.signingInput);
  const sig = new Uint8Array(jwt.signature).buffer;
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sig, input);
  if (!ok) return null;

  const p = jwt.payload;
  if (typeof p.iss !== 'string' || !issMatches(p.iss, expectedIssuer)) return null;
  if (p.aud !== expectedAudience && !(Array.isArray(p.aud) && p.aud.includes(expectedAudience))) return null;
  const CLOCK_SKEW_MS = 60_000;
  if (typeof p.exp !== 'number' || p.exp * 1000 < Date.now() - CLOCK_SKEW_MS) return null;
  if (typeof p.nbf === 'number' && p.nbf * 1000 > Date.now() + CLOCK_SKEW_MS) return null;

  return p;
}

function issMatches(actual: string, expected: string): boolean {
  return actual.replace(/\/$/, '') === expected.replace(/\/$/, '');
}
