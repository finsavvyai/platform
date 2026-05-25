/**
 * Shared crypto helpers for integration tests.
 * Generates REAL ECDSA P-256 keys and signatures — no mocks.
 */

/** Generate a real ECDSA P-256 keypair using Web Crypto. */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, // extractable for tests (non-extractable in prod client)
    ['sign', 'verify'],
  );
}

/** Export a public key as JWK string (for server storage). */
export async function exportPublicKeyJwk(keyPair: CryptoKeyPair): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  return JSON.stringify(jwk);
}

/** Sign a challenge payload: `${sessionId}:${nonce}:${timestamp}`. */
export async function signPayload(
  privateKey: CryptoKey,
  sessionId: string,
  nonce: string,
  timestamp: number,
): Promise<string> {
  const payload = `${sessionId}:${nonce}:${timestamp}`;
  const encoded = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    encoded,
  );
  return arrayBufferToBase64Url(signature);
}

/** Generate a random nonce (16 bytes, base64url). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return arrayBufferToBase64Url(bytes.buffer as ArrayBuffer);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
