/**
 * OAuth Routes for Cloudflare Workers (Hono)
 * Supports 7 providers via unified registry + PKCE.
 * Uses native fetch + Web Crypto — no Node.js deps.
 */
import { Hono } from 'hono';
import { signJWT } from '../auth/jwt';
import {
  OAUTH_PROVIDERS,
  resolveProviderUrl,
  getEnabledProviders,
  type OAuthProviderConfig,
} from '../auth/oauth-providers';
import { generatePKCE } from '../auth/pkce';

type OAuthEnv = {
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
    ENVIRONMENT: string;
    // GitHub
    GITHUB_OAUTH_CLIENT_ID: string;
    GITHUB_OAUTH_CLIENT_SECRET: string;
    // Azure AD / Microsoft
    AZURE_OAUTH_CLIENT_ID: string;
    AZURE_OAUTH_CLIENT_SECRET: string;
    AZURE_TENANT_ID: string;
    // Google
    GOOGLE_OAUTH_CLIENT_ID: string;
    GOOGLE_OAUTH_CLIENT_SECRET: string;
    // LinkedIn
    LINKEDIN_OAUTH_CLIENT_ID: string;
    LINKEDIN_OAUTH_CLIENT_SECRET: string;
    // Discord
    DISCORD_OAUTH_CLIENT_ID: string;
    DISCORD_OAUTH_CLIENT_SECRET: string;
  };
};

const oauthRoute = new Hono<OAuthEnv>();

const FRONTEND_URL = 'https://qestro.app';
const API_BASE = 'https://api.qestro.app/api/auth';

// PKCE verifier persisted to Cloudflare KV (RATE_LIMIT_KV binding, reused
// for its short-TTL auth state scratch space). In-memory Map didn't
// survive Worker isolate boundaries — authorize and callback run on
// different isolates, so the verifier would go missing and token
// exchange would fail (see LinkedIn `invalid_client` debug from
// 2026-04-18). KV gives global consistency and automatic TTL cleanup.
type PkceEntry = { verifier: string };
const PKCE_KEY = (state: string) => `pkce:${state}`;
const PKCE_TTL_SEC = 600; // 10 min, matches OAuth state window

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

function pkceKv(env: Record<string, unknown>): KV | null {
  const kv = env.RATE_LIMIT_KV as KV | undefined;
  return kv ?? null;
}

async function pkcePut(env: Record<string, unknown>, state: string, verifier: string): Promise<void> {
  const kv = pkceKv(env);
  if (!kv) return; // KV unavailable — PKCE becomes best-effort
  await kv.put(PKCE_KEY(state), JSON.stringify({ verifier }), { expirationTtl: PKCE_TTL_SEC });
}

async function pkceTake(env: Record<string, unknown>, state: string): Promise<PkceEntry | null> {
  const kv = pkceKv(env);
  if (!kv) return null;
  const raw = await kv.get(PKCE_KEY(state));
  if (!raw) return null;
  // Single-use: delete immediately to prevent replay
  await kv.delete(PKCE_KEY(state));
  try { return JSON.parse(raw) as PkceEntry; } catch { return null; }
}

// ─── Generic OAuth Initiation ──────────────────────────────

function getEnvRecord(c: { env: Record<string, string> }): Record<string, string> {
  return c.env as Record<string, string>;
}

async function initiateOAuth(
  c: { env: Record<string, string>; redirect: (url: string) => Response; json: (data: unknown, status?: number) => Response },
  provider: OAuthProviderConfig,
) {
  const env = getEnvRecord(c);
  const clientId = env[provider.envClientId];
  if (!clientId) {
    return c.json({ error: `${provider.name} OAuth not configured` }, 503);
  }

  const state = crypto.randomUUID();
  const pkce = await generatePKCE();

  // Store PKCE verifier keyed by state in KV (10 min TTL, single-use)
  if (!provider.noPkce) {
    await pkcePut(env, state, pkce.codeVerifier);
  }

  const baseParams: Record<string, string> = {
    client_id: clientId,
    redirect_uri: `${API_BASE}/${provider.id}/callback`,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    state,
    ...provider.authParams,
  };
  if (!provider.noPkce) {
    baseParams.code_challenge = pkce.codeChallenge;
    baseParams.code_challenge_method = 'S256';
  }
  const params = new URLSearchParams(baseParams);

  const authUrl = resolveProviderUrl(provider.authUrl, env);
  return c.redirect(`${authUrl}?${params.toString()}`);
}

// ─── Generic OAuth Callback ────────────────────────────────

async function handleOAuthCallback(
  c: {
    env: Record<string, string>;
    req: { query: (key: string) => string | undefined };
    redirect: (url: string) => Response;
  },
  provider: OAuthProviderConfig,
) {
  const env = getEnvRecord(c);
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error || !code) {
    return c.redirect(`${FRONTEND_URL}/login?error=${error || 'missing_code'}`);
  }

  // Retrieve PKCE verifier from KV (single-use — pkceTake deletes on read)
  const pkceEntry = state ? await pkceTake(env, state) : null;

  try {
    // Exchange code for token
    const tokenBody: Record<string, string> = {
      client_id: env[provider.envClientId],
      client_secret: env[provider.envClientSecret],
      code,
      redirect_uri: `${API_BASE}/${provider.id}/callback`,
      grant_type: 'authorization_code',
    };

    // Attach PKCE verifier if we have it
    if (pkceEntry) {
      tokenBody.code_verifier = pkceEntry.verifier;
    }

    const tokenUrl = resolveProviderUrl(provider.tokenUrl, env);
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: provider.tokenFormEncoded
        ? { 'Content-Type': 'application/x-www-form-urlencoded' }
        : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: provider.tokenFormEncoded
        ? new URLSearchParams(tokenBody).toString()
        : JSON.stringify(tokenBody),
    });

    const tokenData: Record<string, unknown> = await tokenRes.json();
    const accessTokenValue = tokenData.access_token as string;

    if (!accessTokenValue) {
      return c.redirect(
        `${FRONTEND_URL}/login?error=${(tokenData.error as string) || 'token_exchange_failed'}`,
      );
    }

    // Get user info
    let userData: Record<string, unknown>;

    if (provider.id === 'github') {
      // GitHub needs separate email fetch
      const [userRes, emailRes] = await Promise.all([
        fetch(provider.userInfoUrl, {
          headers: {
            Authorization: `Bearer ${accessTokenValue}`,
            ...provider.userInfoHeaders,
          },
        }),
        fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessTokenValue}`,
            'User-Agent': 'Qestro',
          },
        }),
      ]);
      userData = await userRes.json() as Record<string, unknown>;
      const emails: Array<{ email: string; primary: boolean; verified: boolean }> = await emailRes.json();
      const primary = emails.find((e) => e.primary && e.verified);
      if (primary) userData.email = primary.email;
    } else {
      const userRes = await fetch(provider.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessTokenValue}` },
      });
      userData = await userRes.json() as Record<string, unknown>;
    }

    const user = provider.extractUser(userData);
    if (!user.email) {
      return c.redirect(`${FRONTEND_URL}/login?error=no_email`);
    }

    // Create JWT
    const userId = `${provider.idPrefix}${user.id}`;
    const jwt = await signJWT(
      { userId, email: user.email, role: 'user', provider: provider.id, avatar: user.avatar },
      env.JWT_SECRET,
      86400,
    );
    const refreshToken = await signJWT(
      { userId, type: 'refresh' },
      env.JWT_SECRET,
      604800,
    );

    // Redirect to frontend with tokens
    const params = new URLSearchParams({
      access_token: jwt,
      refresh_token: refreshToken,
      user_id: userId,
      email: user.email,
      name: user.name,
      avatar: user.avatar || '',
      provider: provider.id,
    });

    return c.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`);
  } catch (err) {
    console.error(`${provider.name} OAuth error:`, err);
    return c.redirect(`${FRONTEND_URL}/login?error=server_error`);
  }
}

// ─── Callback Rate Limiter (10 requests per IP per minute) ─

const callbackLimits = new Map<string, { count: number; resetAt: number }>();
function isCallbackRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = callbackLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    callbackLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

// ─── Register All Provider Routes ──────────────────────────

for (const provider of Object.values(OAUTH_PROVIDERS)) {
  oauthRoute.get(`/${provider.id}`, (c) => initiateOAuth(c as any, provider));
  oauthRoute.get(`/${provider.id}/callback`, (c) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    if (isCallbackRateLimited(ip)) {
      return c.json({ error: 'Too many callback attempts' }, 429);
    }
    return handleOAuthCallback(c as any, provider);
  });
}

// Apple uses form_post, so we need a POST handler too

// ─── Provider Discovery ─────────────────────────────────

oauthRoute.get('/providers', (c) => {
  const env = getEnvRecord(c);
  const enabled = getEnabledProviders(env);

  const providers = enabled.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    enabled: true,
    loginUrl: `${API_BASE}/${p.id}`,
    type: p.type,
    iconSvg: p.iconSvg,
    brandColor: p.brandColor,
  }));

  // Always include email/password
  providers.push({
    id: 'email',
    name: 'Email',
    displayName: 'Email & Password',
    enabled: true,
    loginUrl: `${API_BASE}/login`,
    type: 'credentials' as any,
    iconSvg: '',
    brandColor: '#6B7280',
  });

  return c.json({ success: true, providers });
});

export default oauthRoute;
