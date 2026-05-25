import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';
import { ensureUser } from '../utils/ensure-user.js';
import { escapeHtml } from '../lib/html-escape.js';
import { createDb } from '../lib/db.js';

// Web BFFs mint session tokens prefixed with `sjwt_` (see packages/auth/src/token.ts).
// Strip the prefix before treating the rest as a raw HS256 JWT.
const SJWT_PREFIX = 'sjwt_';

function base64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

function decodeJwt(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');
  const [headerB64, payloadB64] = parts;
  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64!)));
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64!)));
  return { header, payload };
}

async function verifyHmac(token: string, secret: string): Promise<boolean> {
  const [headerB64, payloadB64, sigB64] = token.split('.');
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}` as string);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
  const actual = base64urlDecode(sigB64!);
  if (expected.length !== actual.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) result |= expected[i]! ^ actual[i]!;
  return result === 0;
}

/**
 * Authentication middleware using Auth.js HMAC-SHA256
 * Verifies the JWT signature via AUTH_SECRET and extracts the userId
 */
export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
    }

    const rawToken = authHeader.slice(7);
    const token = rawToken.startsWith(SJWT_PREFIX) ? rawToken.slice(SJWT_PREFIX.length) : rawToken;

    try {
      const { header, payload } = decodeJwt(token);

      if (header?.alg !== 'HS256') {
        return c.json({ error: 'Unauthorized', message: 'Unsupported token algorithm' }, 401);
      }
      if (header?.typ && header.typ !== 'JWT') {
        return c.json({ error: 'Unauthorized', message: 'Invalid token type' }, 401);
      }

      const valid = await verifyHmac(token, c.env.AUTH_SECRET);
      if (!valid) {
        return c.json({ error: 'Unauthorized', message: 'Invalid token signature' }, 401);
      }

      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.exp !== 'number') {
        return c.json({ error: 'Unauthorized', message: 'Token missing exp claim' }, 401);
      }
      if (payload.exp <= now) {
        return c.json({ error: 'Unauthorized', message: 'Token expired' }, 401);
      }
      if (typeof payload.nbf === 'number' && payload.nbf > now) {
        return c.json({ error: 'Unauthorized', message: 'Token not yet valid' }, 401);
      }

      const expectedIss = (c.env as { AUTH_JWT_ISSUER?: string }).AUTH_JWT_ISSUER;
      if (expectedIss && payload.iss !== expectedIss) {
        return c.json({ error: 'Unauthorized', message: 'Invalid token issuer' }, 401);
      }
      const expectedAud = (c.env as { AUTH_JWT_AUDIENCE?: string }).AUTH_JWT_AUDIENCE;
      if (expectedAud && payload.aud !== expectedAud) {
        return c.json({ error: 'Unauthorized', message: 'Invalid token audience' }, 401);
      }

      // JIT provisioning: email is the stable identity, not JWT sub.
      // Self-provision the db handle if dbMiddleware hasn't run yet — this
      // lets route modules put authMiddleware FIRST in the chain so that
      // anonymous callers short-circuit on the 401 above and never touch
      // any code path that could throw a 500.
      const jwtUserId = payload.sub as string;
      let db = c.get('db');
      if (!db) {
        db = createDb(c.env.DB);
        c.set('db', db);
      }
      let canonicalUserId = jwtUserId;

      try {
        const result = await ensureUser(db, jwtUserId, payload.email as string | undefined, payload.name as string | undefined);
        canonicalUserId = result.userId;

        if (result.isNew && payload.email && c.env.RESEND_API_KEY) {
          sendWelcomeEmail(c.env.RESEND_API_KEY, payload.email as string, payload.name as string | undefined);
        }
      } catch (err) {
        console.error('[Auth] JIT provisioning error:', err instanceof Error ? err.message : err);
      }

      c.set('userId', canonicalUserId);

      await next();
    } catch (error) {
      console.error('Auth verification failed:', error instanceof Error ? error.message : 'Unknown error');
      return c.json({ error: 'Unauthorized', message: 'Authentication failed' }, 401);
    }
  },
);

/** Non-blocking welcome email for newly provisioned users */
function sendWelcomeEmail(apiKey: string, email: string, name?: string) {
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'OpenSyber <hello@opensyber.cloud>',
      to: [email],
      subject: 'Welcome to OpenSyber',
      html: [
        '<h2>Welcome to OpenSyber!</h2>',
        `<p>Hi ${escapeHtml(name ?? 'there')},</p>`,
        '<p>Your account is ready. Deploy your first AI agent in 60 seconds.</p>',
        '<p><a href="https://opensyber.cloud/dashboard">Go to Dashboard &rarr;</a></p>',
        '<p>&mdash; The OpenSyber Team</p>',
      ].join(''),
    }),
  }).catch((err) => console.error('[WelcomeEmail] Failed:', err instanceof Error ? err.message : err));
}
