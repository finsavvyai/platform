/**
 * DPoP-style ES256 JWS signer for the browser SDK.
 *
 * Output format matches the server's `verifyCompactJws` (raw r||s
 * signature). The signing input is `<header>.<payload>` where both
 * halves are base64url-encoded JSON.
 */

export interface DpopClaims {
  sub: string;       // session_id
  nonce: string;     // server-issued challenge
  iat?: number;
  exp?: number;
  htu?: string;
  htm?: string;
  [k: string]: unknown;
}

export async function signDpop(
  privateKey: CryptoKey,
  claims: DpopClaims,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    ...claims,
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + 30,
  };
  const header = { alg: 'ES256', typ: 'JWT' };
  const headerB64 = b64u(JSON.stringify(header));
  const payloadB64 = b64u(JSON.stringify(payload));
  const input = `${headerB64}.${payloadB64}`;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(input) as BufferSource,
  );
  return `${input}.${bytesToB64u(new Uint8Array(sig))}`;
}

function b64u(s: string): string {
  return bytesToB64u(new TextEncoder().encode(s));
}

function bytesToB64u(b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
