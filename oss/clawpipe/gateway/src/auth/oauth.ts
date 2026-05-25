/** OAuth handlers — Google and GitHub social login flows. */

import type { Env } from '../types';
import { createToken, sessionCookie } from './jwt';

/** GET /auth/google — redirect to Google OAuth. */
export function handleGoogleRedirect(env: Env, origin: string): Response {
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) return Response.json({ error: 'Google OAuth not configured' }, { status: 503 });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: crypto.randomUUID(),
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}

/** GET /auth/google/callback — exchange code for tokens. */
export async function handleGoogleCallback(request: Request, env: Env): Promise<Response> {
  const secret = env.AUTH_SECRET;
  if (!secret || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return Response.json({ error: 'Google OAuth not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return Response.json({ error: 'Missing authorization code' }, { status: 400 });

  const origin = url.origin;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/auth/google/callback`, grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) return Response.json({ error: 'Token exchange failed' }, { status: 502 });
  const tokens = await tokenRes.json() as { access_token: string };

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json() as { id: string; email: string; name: string; picture: string };

  if (!profile.email || !isValidEmail(profile.email)) {
    return Response.json({ error: 'Google account has no accessible verified email' }, { status: 400 });
  }

  const user = await upsertOAuthUser(env, 'google', profile.id, profile.email, profile.name, profile.picture);
  const jwt = await createToken({ sub: user.id, email: user.email, name: user.name }, secret);

  return new Response(null, {
    status: 302,
    headers: { Location: `${origin.replace('api.', 'app.')}/dashboard`, 'Set-Cookie': sessionCookie(jwt) },
  });
}

/** GET /auth/github — redirect to GitHub OAuth. */
export function handleGithubRedirect(env: Env, origin: string): Response {
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) return Response.json({ error: 'GitHub OAuth not configured' }, { status: 503 });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/auth/github/callback`,
    scope: 'read:user user:email',
    state: crypto.randomUUID(),
  });

  return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
}

/** GET /auth/github/callback — exchange code for tokens. */
export async function handleGithubCallback(request: Request, env: Env): Promise<Response> {
  const secret = env.AUTH_SECRET;
  if (!secret || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return Response.json({ error: 'GitHub OAuth not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return Response.json({ error: 'Missing authorization code' }, { status: 400 });

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
  });

  const tokens = await tokenRes.json() as { access_token: string };
  const profileRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'ClawPipe' },
  });
  const profile = await profileRes.json() as { id: number; email: string; name: string; avatar_url: string };

  let email = profile.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'ClawPipe' },
    });
    const emails = await emailsRes.json() as Array<{ email: string; primary: boolean }>;
    email = emails.find((e) => e.primary)?.email ?? emails[0]?.email ?? '';
  }

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: 'GitHub account has no accessible verified email' }, { status: 400 });
  }

  const origin = url.origin;
  const user = await upsertOAuthUser(env, 'github', String(profile.id), email, profile.name, profile.avatar_url);
  const jwt = await createToken({ sub: user.id, email: user.email, name: user.name }, secret);

  return new Response(null, {
    status: 302,
    headers: { Location: `${origin.replace('api.', 'app.')}/dashboard`, 'Set-Cookie': sessionCookie(jwt) },
  });
}

/** Basic RFC 5322-compatible email format check. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Upsert a user from an OAuth provider. Links accounts if email matches. */
async function upsertOAuthUser(
  env: Env, provider: string, providerId: string,
  email: string, name: string, avatarUrl: string,
): Promise<{ id: string; email: string; name: string }> {
  const existing = await env.DB.prepare(
    'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?',
  ).bind(provider, providerId).first<{ user_id: string }>();

  if (existing) {
    const user = await env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?')
      .bind(existing.user_id).first<{ id: string; email: string; name: string }>();
    if (user) return user;
  }

  const userByEmail = await env.DB.prepare('SELECT id, email, name FROM users WHERE email = ?')
    .bind(email.toLowerCase()).first<{ id: string; email: string; name: string }>();

  if (userByEmail) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO oauth_accounts (id, user_id, provider, provider_account_id) VALUES (?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), userByEmail.id, provider, providerId).run();
    return userByEmail;
  }

  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id, email, name, avatar_url, email_verified) VALUES (?, ?, ?, ?, 1)')
      .bind(id, email.toLowerCase(), name, avatarUrl),
    env.DB.prepare('INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), id, provider, providerId),
  ]);

  return { id, email: email.toLowerCase(), name };
}
