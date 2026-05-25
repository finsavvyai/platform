/**
 * SSO Token Generator
 *
 * Creates HMAC-SHA256 signed JWTs for SSO callback redirects.
 * Uses Web Crypto API (Cloudflare Workers compatible).
 */

function base64url(data: string): string {
  return btoa(data).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Generate a signed JWT for SSO session establishment.
 *
 * @param userId - The provisioned user's ID
 * @param secret - AUTH_SECRET for HMAC-SHA256 signing
 * @returns Signed JWT string
 */
export async function generateSsoToken(userId: string, secret: string): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  }));
  const data = `${header}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signature = base64url(String.fromCharCode(...new Uint8Array(sig)));

  return `${data}.${signature}`;
}
