/** Generic OIDC SSO — enterprise IdP integration (Okta, Azure AD, Auth0, Keycloak). */

import type { Env } from '../types';
import { createToken, sessionCookie } from './jwt';
import { verifyIdToken } from './jwks';

interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}

interface IdTokenClaims {
  sub: string; email?: string; email_verified?: boolean;
  name?: string; preferred_username?: string; picture?: string;
}

/** Cached discovery doc (per isolate). */
let _discoveryCache: { issuer: string; doc: OidcDiscovery; fetchedAt: number } | null = null;

async function discover(issuer: string): Promise<OidcDiscovery> {
  if (_discoveryCache && _discoveryCache.issuer === issuer && Date.now() - _discoveryCache.fetchedAt < 3_600_000) {
    return _discoveryCache.doc;
  }
  const base = issuer.replace(/\/$/, '');
  const res = await fetch(`${base}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const doc = await res.json() as OidcDiscovery;
  _discoveryCache = { issuer, doc, fetchedAt: Date.now() };
  return doc;
}

function redirectOrigin(env: Env, request: Request): string {
  return env.OIDC_REDIRECT_ORIGIN || new URL(request.url).origin;
}

const OIDC_STATE_COOKIE = 'clawpipe_oidc_state';

function oidcStateCookie(value: string): string {
  return `${OIDC_STATE_COOKIE}=${value}; Path=/auth/oidc; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

function clearOidcStateCookie(): string {
  return `${OIDC_STATE_COOKIE}=; Path=/auth/oidc; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie') ?? '';
  const m = raw.match(new RegExp(`${name}=([^;]+)`));
  return m ? m[1] : null;
}

/** GET /auth/oidc — redirect to IdP with state + nonce; stash both in cookie. */
export async function handleOidcRedirect(request: Request, env: Env): Promise<Response> {
  if (!env.OIDC_ISSUER || !env.OIDC_CLIENT_ID) {
    return Response.json({ error: 'OIDC SSO not configured' }, { status: 503 });
  }
  const doc = await discover(env.OIDC_ISSUER);
  const origin = redirectOrigin(env, request);
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.OIDC_CLIENT_ID,
    redirect_uri: `${origin}/auth/oidc/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state, nonce,
  });
  const cookieVal = btoa(JSON.stringify({ state, nonce }));
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${doc.authorization_endpoint}?${params}`,
      'Set-Cookie': oidcStateCookie(cookieVal),
    },
  });
}

/** Verify id_token via RS256 + JWKS. Checks iss / aud / exp claims. */
async function verifyClaims(
  jwt: string, doc: OidcDiscovery, audience: string,
): Promise<IdTokenClaims | null> {
  const payload = await verifyIdToken(jwt, doc.jwks_uri, doc.issuer, audience);
  return payload as IdTokenClaims | null;
}

/** GET /auth/oidc/callback — exchange code, upsert user, set session cookie. */
export async function handleOidcCallback(request: Request, env: Env): Promise<Response> {
  if (!env.AUTH_SECRET || !env.OIDC_ISSUER || !env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET) {
    return Response.json({ error: 'OIDC SSO not configured' }, { status: 503 });
  }
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  if (!code) return Response.json({ error: 'Missing authorization code' }, { status: 400 });

  const cookieRaw = readCookie(request, OIDC_STATE_COOKIE);
  if (!cookieRaw) return Response.json({ error: 'Missing OIDC state cookie' }, { status: 400 });
  let stash: { state: string; nonce: string };
  try { stash = JSON.parse(atob(cookieRaw)); }
  catch { return Response.json({ error: 'Invalid OIDC state cookie' }, { status: 400 }); }
  if (stash.state !== returnedState) {
    return Response.json({ error: 'OIDC state mismatch' }, { status: 400 });
  }

  const doc = await discover(env.OIDC_ISSUER);
  const origin = redirectOrigin(env, request);

  const tokenRes = await fetch(doc.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: env.OIDC_CLIENT_ID,
      client_secret: env.OIDC_CLIENT_SECRET,
      redirect_uri: `${origin}/auth/oidc/callback`,
    }),
  });
  if (!tokenRes.ok) return Response.json({ error: 'Token exchange failed' }, { status: 502 });
  const tokens = await tokenRes.json() as { id_token?: string; access_token?: string };

  let claims = tokens.id_token ? await verifyClaims(tokens.id_token, doc, env.OIDC_CLIENT_ID) : null;
  if (tokens.id_token && !claims) {
    return Response.json({ error: 'id_token signature or claims invalid' }, { status: 401 });
  }
  if (claims && (claims as { nonce?: string }).nonce !== stash.nonce) {
    return Response.json({ error: 'OIDC nonce mismatch' }, { status: 400 });
  }
  if (!claims?.email && tokens.access_token && doc.userinfo_endpoint) {
    const uiRes = await fetch(doc.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (uiRes.ok) claims = { ...(claims ?? { sub: '' }), ...(await uiRes.json() as IdTokenClaims) };
  }
  if (!claims?.email || !claims.sub) {
    return Response.json({ error: 'OIDC provider did not return email/sub' }, { status: 400 });
  }

  const user = await upsertOidcUser(env, claims.sub, claims.email, claims.name || claims.preferred_username || claims.email, claims.picture ?? '');
  const jwt = await createToken({ sub: user.id, email: user.email, name: user.name }, env.AUTH_SECRET);
  const appOrigin = origin.replace('api.', 'app.');

  const headers = new Headers({ Location: `${appOrigin}/` });
  headers.append('Set-Cookie', sessionCookie(jwt));
  headers.append('Set-Cookie', clearOidcStateCookie());
  return new Response(null, { status: 302, headers });
}

async function upsertOidcUser(
  env: Env, providerId: string, email: string, name: string, avatarUrl: string,
): Promise<{ id: string; email: string; name: string }> {
  const existing = await env.DB.prepare(
    'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?',
  ).bind('oidc', providerId).first<{ user_id: string }>();

  if (existing) {
    const user = await env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?')
      .bind(existing.user_id).first<{ id: string; email: string; name: string }>();
    if (user) return user;
  }

  const normalizedEmail = email.toLowerCase();
  const byEmail = await env.DB.prepare('SELECT id, email, name FROM users WHERE email = ?')
    .bind(normalizedEmail).first<{ id: string; email: string; name: string }>();
  if (byEmail) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO oauth_accounts (id, user_id, provider, provider_account_id) VALUES (?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), byEmail.id, 'oidc', providerId).run();
    return byEmail;
  }

  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id, email, name, avatar_url, email_verified) VALUES (?, ?, ?, ?, 1)')
      .bind(id, normalizedEmail, name, avatarUrl),
    env.DB.prepare('INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), id, 'oidc', providerId),
  ]);
  return { id, email: normalizedEmail, name };
}
