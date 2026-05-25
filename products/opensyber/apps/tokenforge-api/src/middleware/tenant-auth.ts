import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { tfApiKeys, tfTenants } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { hashApiKey } from '../lib/hash.js';
import { createDb } from '../lib/db.js';
import { verifyApiToken } from '@opensyber/auth/token';

type AuthContext = Context<{ Bindings: Env; Variables: Variables }>;

const SESSION_TOKEN_PREFIX = 'sjwt_';
const API_KEY_PREFIX = 'tf_';

/**
 * Extract hostname from Origin or Referer header.
 * Returns null if neither header is present (server-to-server).
 */
function extractRequestDomain(origin?: string, referer?: string): string | null {
  const raw = origin ?? referer;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return raw;
  }
}

/**
 * Check whether the request domain is in the allowed list.
 * Supports wildcard subdomains (e.g., "*.example.com").
 */
function isDomainAllowed(domain: string, allowed: string[]): boolean {
  return allowed.some((pattern) => {
    if (pattern.startsWith('*.')) {
      const base = pattern.slice(2);
      return domain === base || domain.endsWith(`.${base}`);
    }
    return domain === pattern;
  });
}

function slugifyEmail(email: string): string {
  return email.split('@')[0]?.replace(/[^a-z0-9-]/gi, '-').toLowerCase() ?? '';
}

/**
 * Tenant authentication middleware.
 * Accepts two Bearer token formats:
 *   - `tf_...`   — long-lived SDK API key, hashed against tf_api_keys
 *   - `sjwt_...` — short-lived HS256 token minted by the web BFF from an
 *                  Auth.js session; resolves tenant by email-derived slug and
 *                  auto-provisions a free-plan tenant on first session auth.
 * On success sets tenantId + tenantPlan context variables.
 */
export const tenantAuth = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      { error: 'unauthorized', message: 'Missing or invalid Authorization header' },
      401,
    );
  }
  const token = authHeader.slice(7);

  if (token.startsWith(SESSION_TOKEN_PREFIX)) {
    return authenticateSession(c, token, next);
  }
  if (token.startsWith(API_KEY_PREFIX)) {
    return authenticateApiKey(c, token, next);
  }
  return c.json(
    { error: 'unauthorized', message: 'Invalid token format' },
    401,
  );
});

async function authenticateSession(
  c: AuthContext,
  token: string,
  next: () => Promise<void>,
): Promise<Response | void> {
  if (!c.env.AUTH_SECRET) {
    return c.json(
      { error: 'unauthorized', message: 'Session auth not configured' },
      401,
    );
  }
  const claims = await verifyApiToken(token, c.env.AUTH_SECRET);
  if (!claims || !claims.email) {
    return c.json(
      { error: 'unauthorized', message: 'Invalid or expired session token' },
      401,
    );
  }

  const db = c.get('db') ?? createDb(c.env.DB);
  const slug = slugifyEmail(claims.email);
  const existing = await db
    .select({ id: tfTenants.id, plan: tfTenants.plan })
    .from(tfTenants)
    .where(eq(tfTenants.slug, slug));

  let tenantId: string;
  let plan: string;

  if (existing.length > 0) {
    const row = existing[0]!;
    tenantId = row.id;
    plan = row.plan;
  } else {
    tenantId = `tf_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    plan = 'free';
    const now = new Date().toISOString();
    await db.insert(tfTenants).values({
      id: tenantId,
      name: claims.email.split('@')[0] ?? 'user',
      slug,
      ownerUserId: claims.sub,
      plan: 'free',
      createdAt: now,
      updatedAt: now,
    });
  }

  c.set('tenantId', tenantId);
  c.set('tenantPlan', plan);
  await next();
}

async function authenticateApiKey(
  c: AuthContext,
  apiKey: string,
  next: () => Promise<void>,
): Promise<Response | void> {
  const keyHash = await hashApiKey(apiKey);
  const db = c.get('db') ?? createDb(c.env.DB);

  const results = await db
    .select({
      keyId: tfApiKeys.id,
      tenantId: tfApiKeys.tenantId,
      isActive: tfApiKeys.isActive,
      expiresAt: tfApiKeys.expiresAt,
      tenantPlan: tfTenants.plan,
    })
    .from(tfApiKeys)
    .innerJoin(tfTenants, eq(tfApiKeys.tenantId, tfTenants.id))
    .where(eq(tfApiKeys.keyHash, keyHash));

  if (results.length === 0) {
    return c.json({ error: 'unauthorized', message: 'Invalid API key' }, 401);
  }

  const record = results[0]!;
  if (!record.isActive) {
    return c.json({ error: 'unauthorized', message: 'API key is inactive' }, 401);
  }
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return c.json({ error: 'unauthorized', message: 'API key has expired' }, 401);
  }

  const requestDomain = extractRequestDomain(
    c.req.header('Origin'),
    c.req.header('Referer'),
  );
  if (requestDomain) {
    const domainsJson = await c.env.CACHE.get(`domains:${record.keyId}`);
    if (domainsJson) {
      const allowed = JSON.parse(domainsJson) as string[];
      if (allowed.length > 0 && !isDomainAllowed(requestDomain, allowed)) {
        return c.json(
          { error: 'domain_not_allowed', message: 'This API key is not authorized for this domain' },
          403,
        );
      }
    }
  }

  c.executionCtx.waitUntil(
    db
      .update(tfApiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(tfApiKeys.id, record.keyId)),
  );

  c.set('tenantId', record.tenantId);
  c.set('tenantPlan', record.tenantPlan);
  await next();
}
