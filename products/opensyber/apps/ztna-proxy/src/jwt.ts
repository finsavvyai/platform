/**
 * Auth.js HMAC-SHA256 JWT verification.
 * Mirrors the logic in apps/api/src/middleware/auth.ts so this proxy can
 * accept tokens issued by opensyber-api without round-tripping through it.
 */

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

interface JwtPayload {
  sub?: string;
  userId?: string;
  sessionId?: string;
  exp?: number;
  [key: string]: unknown;
}

interface JwtHeader {
  alg?: string;
  typ?: string;
}

function decodeJwt(token: string): { header: JwtHeader; payload: JwtPayload } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');
  const [headerB64, payloadB64] = parts;
  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64!))) as JwtHeader;
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64!))) as JwtPayload;
  return { header, payload };
}

async function verifyHmac(token: string, secret: string): Promise<boolean> {
  const [headerB64, payloadB64, sigB64] = token.split('.');
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
  const actual = base64urlDecode(sigB64!);
  if (expected.length !== actual.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) result |= expected[i]! ^ actual[i]!;
  return result === 0;
}

export interface VerifiedIdentity {
  userId: string;
  sessionId: string | null;
}

/**
 * Verify Bearer token and extract userId+sessionId.
 * Returns null on any failure — caller responds 401.
 */
export async function verifyBearer(
  authHeader: string | null,
  secret: string,
): Promise<VerifiedIdentity | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  try {
    const { header, payload } = decodeJwt(token);
    if (header.alg !== 'HS256') return null;
    if (header.typ && header.typ !== 'JWT') return null;

    const valid = await verifyHmac(token, secret);
    if (!valid) return null;

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    const userId = (payload.userId as string | undefined) ?? payload.sub;
    if (!userId) return null;

    return {
      userId,
      sessionId: (payload.sessionId as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}
