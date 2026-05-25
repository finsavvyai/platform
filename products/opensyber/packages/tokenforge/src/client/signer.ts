/**
 * Challenge-response signing protocol.
 *
 * **v2** signs: `${method}:${path}:${bodyHash}:${sessionId}:${nonce}:${timestamp}`
 * where bodyHash is the hex SHA-256 of the request body (empty string for GET/HEAD).
 *
 * **v1** (legacy) signs: `${sessionId}:${nonce}:${timestamp}`.
 *
 * Also exports `isNativeDbscAvailable()` — feature-detect for the W3C
 * Device-Bound Session Credentials API (Chrome 146+). When present, the
 * SDK can defer key generation + binding to the platform; otherwise it
 * continues using the Web Crypto fallback path implemented here.
 */

/** Protocol version — determines signature input format. */
export const TF_PROTOCOL_VERSION = '2';

/**
 * Compute hex-encoded SHA-256 of arbitrary text.
 * Uses Web Crypto — works in browsers and Cloudflare Workers.
 */
export async function sha256Hex(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build the v2 signature input that covers HTTP method, path, and body.
 * @returns The string to be signed with ECDSA P-256.
 */
export async function buildSignatureInput(
  sessionId: string, nonce: string, timestamp: string,
  method: string, path: string, body: string | null,
): Promise<string> {
  const bodyHash = await sha256Hex(body ?? '');
  return `${method}:${path}:${bodyHash}:${sessionId}:${nonce}:${timestamp}`;
}

/**
 * Sign a challenge payload with the device-bound private key (v2 format).
 * Includes HTTP method, URL path, and body hash in the signed payload.
 */
export async function signChallenge(
  privateKey: CryptoKey,
  sessionId: string,
  nonce: string,
  timestamp: number,
  method?: string,
  path?: string,
  body?: string | null,
): Promise<{ signature: string; bodyHash: string }> {
  const bodyHash = await sha256Hex(body ?? '');
  const payload = method && path
    ? `${method}:${path}:${bodyHash}:${sessionId}:${nonce}:${timestamp}`
    : `${sessionId}:${nonce}:${timestamp}`;
  const encoded = new TextEncoder().encode(payload);

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    encoded,
  );

  return { signature: arrayBufferToBase64Url(signature), bodyHash };
}

/**
 * Generate a client-side nonce.
 * Server will verify this hasn't been used before.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return arrayBufferToBase64Url(bytes.buffer as ArrayBuffer);
}

export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Feature-detect the W3C Device-Bound Session Credentials API.
 *
 * Returns `true` when `navigator.deviceBoundSession` is a real object the
 * SDK could route through. Treats undefined / null / non-object values
 * (functions, primitives) as unavailable so a downgrade attacker who
 * shadows `navigator` with a truthy primitive does not flip the SDK into
 * thinking native DBSC is present.
 *
 * Spec: https://w3c.github.io/webappsec-dbsc/ (Chrome 146+)
 */
export function isNativeDbscAvailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceBoundSession?: unknown };
  const candidate = nav.deviceBoundSession;
  return typeof candidate === 'object' && candidate !== null;
}
