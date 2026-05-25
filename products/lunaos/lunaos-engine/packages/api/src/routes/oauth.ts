/**
 * OAuth routes — GET /auth/oauth/:provider, GET /auth/oauth/:provider/callback
 * Social login with Google, GitHub, Microsoft
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { signJWT } from '../utils/jwt';
import {
  getProvider,
  isValidProvider,
  getClientCredentials,
  buildAuthUrl,
} from '../services/oauth-providers';
import {
  exchangeCodeForToken,
  fetchUserProfile,
} from '../services/oauth-exchange';
import { findOrCreateOAuthUser } from '../services/oauth-user';

export const oauthRoutes = new Hono<{ Bindings: Env }>();

const DASHBOARD_URL = 'https://agents.lunaos.ai/dashboard';
const STATE_TTL_SECONDS = 600; // 10 minutes
const AUTH_CODE_TTL_SECONDS = 60; // 1 minute for code exchange

/**
 * Build the callback redirect URI for a provider
 */
function callbackUri(baseUrl: string, provider: string): string {
  return `${baseUrl}/auth/oauth/${provider}/callback`;
}

/**
 * GET /auth/oauth/:provider — redirect to provider authorization page
 */
oauthRoutes.get('/:provider', async (c) => {
  const providerName = c.req.param('provider');

  if (!isValidProvider(providerName)) {
    return c.json({ error: 'Unsupported provider. Use: google, github, microsoft' }, 400);
  }

  const provider = getProvider(providerName);

  let creds: { clientId: string; clientSecret: string };
  try {
    creds = getClientCredentials(providerName, c.env as unknown as Record<string, string>);
  } catch {
    return c.json({ error: `OAuth not configured for ${providerName}` }, 501);
  }

  // Generate state token for CSRF protection
  const state = crypto.randomUUID();
  await c.env.KV.put(`oauth_state:${state}`, providerName, {
    expirationTtl: STATE_TTL_SECONDS,
  });

  const baseUrl = new URL(c.req.url).origin;
  const redirectUri = callbackUri(baseUrl, providerName);
  const authUrl = buildAuthUrl(provider, creds.clientId, redirectUri, state);

  return c.redirect(authUrl);
});

/**
 * GET /auth/oauth/:provider/callback — handle provider callback
 */
oauthRoutes.get('/:provider/callback', async (c) => {
  const providerName = c.req.param('provider');
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${DASHBOARD_URL}?error=oauth_denied`);
  }

  if (!code || !state) {
    return c.redirect(`${DASHBOARD_URL}?error=oauth_missing_params`);
  }

  if (!isValidProvider(providerName)) {
    return c.redirect(`${DASHBOARD_URL}?error=invalid_provider`);
  }

  // Validate state token (CSRF protection)
  const storedProvider = await c.env.KV.get(`oauth_state:${state}`);
  if (!storedProvider || storedProvider !== providerName) {
    return c.redirect(`${DASHBOARD_URL}?error=invalid_state`);
  }
  await c.env.KV.delete(`oauth_state:${state}`);

  try {
    const provider = getProvider(providerName);
    const creds = getClientCredentials(providerName, c.env as unknown as Record<string, string>);
    const baseUrl = new URL(c.req.url).origin;
    const redirectUri = callbackUri(baseUrl, providerName);

    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(
      provider, code, creds.clientId, creds.clientSecret, redirectUri,
    );

    // Fetch user profile
    const profile = await fetchUserProfile(provider, tokens.access_token);

    // Find or create user and link OAuth account
    const user = await findOrCreateOAuthUser(c.env, profile, providerName, tokens);

    // Issue JWT (1-hour expiry)
    const jwt = await signJWT(
      { sub: user.id, email: user.email, tier: user.tier },
      c.env.JWT_SECRET,
      1,
    );

    // Store JWT behind a short-lived auth code (avoid JWT in URL)
    const authCode = crypto.randomUUID();
    await c.env.KV.put(`auth_code:${authCode}`, jwt, {
      expirationTtl: AUTH_CODE_TTL_SECONDS,
    });

    return c.redirect(`${DASHBOARD_URL}?code=${authCode}`);
  } catch (err) {
    console.error(`[OAuth] ${providerName} callback error:`, err);
    return c.redirect(`${DASHBOARD_URL}?error=oauth_failed`);
  }
});

/**
 * POST /auth/exchange-code — exchange short-lived auth code for JWT
 */
oauthRoutes.post('/exchange-code', async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) {
    return c.json({ error: 'Missing code' }, 400);
  }

  const jwt = await c.env.KV.get(`auth_code:${code}`);
  if (!jwt) {
    return c.json({ error: 'Invalid or expired code' }, 400);
  }

  await c.env.KV.delete(`auth_code:${code}`);
  return c.json({ token: jwt });
});

