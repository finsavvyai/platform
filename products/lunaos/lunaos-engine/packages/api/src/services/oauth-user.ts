/**
 * OAuth user management — find or create user, link OAuth account
 * Encrypts OAuth tokens at rest using AES-GCM.
 */

import type { Env } from '../worker';
import { encryptToken } from '../utils/token-encryption';

/**
 * Resolve encryption key from env (prefer dedicated key, fall back to JWT_SECRET)
 */
function getEncryptionKey(env: Env): string {
  return (env as unknown as Record<string, string>).OAUTH_ENCRYPTION_KEY
    ?? env.JWT_SECRET;
}

/**
 * Find existing user by email or create new one, then link OAuth account.
 * OAuth tokens are encrypted at rest using AES-GCM before DB storage.
 */
export async function findOrCreateOAuthUser(
  env: Env,
  profile: { email: string; name: string; avatarUrl?: string; providerId: string },
  provider: string,
  tokens: { access_token: string; refresh_token?: string },
): Promise<{ id: string; email: string; tier: string }> {
  const email = profile.email.toLowerCase();
  const now = new Date().toISOString();

  let user = await env.DB.prepare(
    'SELECT id, email, tier FROM users WHERE email = ?',
  ).bind(email).first<{ id: string; email: string; tier: string }>();

  if (!user) {
    const userId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, password_hash, tier, avatar_url, oauth_provider, created_at, updated_at)
       VALUES (?, ?, ?, '', 'free', ?, ?, ?, ?)`,
    ).bind(userId, email, profile.name, profile.avatarUrl ?? null, provider, now, now).run();
    user = { id: userId, email, tier: 'free' };
  } else {
    await env.DB.prepare(
      'UPDATE users SET avatar_url = COALESCE(avatar_url, ?), updated_at = ? WHERE id = ?',
    ).bind(profile.avatarUrl ?? null, now, user.id).run();
  }

  // Encrypt tokens before storage
  const secret = getEncryptionKey(env);
  const encAccessToken = await encryptToken(tokens.access_token, secret);
  const encRefreshToken = tokens.refresh_token
    ? await encryptToken(tokens.refresh_token, secret)
    : null;

  // Upsert OAuth account link with encrypted tokens
  await env.DB.prepare(
    `INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, access_token, refresh_token, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider, provider_account_id) DO UPDATE SET access_token = ?, refresh_token = ?`,
  ).bind(
    crypto.randomUUID(), user.id, provider, profile.providerId,
    encAccessToken, encRefreshToken, now,
    encAccessToken, encRefreshToken,
  ).run();

  return user;
}
