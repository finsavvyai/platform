/** JWT session tokens using HMAC-SHA256 via Web Crypto API. */

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  iat: number;
  exp: number;
}

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** Create a signed JWT token. */
export async function createToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = { ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS };

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(fullPayload));
  const signingInput = `${header}.${body}`;

  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${b64url(sig)}`;
}

/** Verify and decode a JWT token. Returns null if invalid/expired. */
export async function verifyToken(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const signingInput = `${header}.${body}`;

  const key = await importKey(secret);
  const sig = b64urlDecode(signature);
  const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(signingInput));
  if (!valid) return null;

  try {
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Extract token from Authorization header or cookie. */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const match = cookie.match(/clawpipe_session=([^;]+)/);
  return match ? match[1] : null;
}

/** Create a Set-Cookie header for the session token. */
export function sessionCookie(token: string, maxAge = TOKEN_TTL_SECONDS): string {
  return `clawpipe_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Create a Set-Cookie header that clears the session. */
export function clearSessionCookie(): string {
  return 'clawpipe_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), ALGORITHM, false, ['sign', 'verify']);
}

function b64url(input: string | ArrayBuffer): string {
  const str = typeof input === 'string' ? btoa(input) : btoa(String.fromCharCode(...new Uint8Array(input)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(input: string): ArrayBuffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
