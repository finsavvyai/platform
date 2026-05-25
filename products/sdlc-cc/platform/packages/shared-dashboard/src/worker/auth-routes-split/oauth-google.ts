/**
 * Auth Routes - Google OAuth flow
 */

import { Hono } from 'hono';
import '../types';
import {
  generateToken,
  createSession,
  getUserByEmail,
} from '../auth-secure';
import type { Env } from './types';

const googleOAuthRoutes = new Hono<{ Bindings: Env }>();

/** GET /google - Initiate Google OAuth flow */
googleOAuthRoutes.get('/google', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return c.json({
      error: 'OAuth not configured',
      message: 'Google OAuth is not configured on this server',
    }, 503);
  }

  const redirectUri = `${new URL(c.req.url).origin}/auth/google/callback`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

/** GET /google/callback - Handle Google OAuth callback */
googleOAuthRoutes.get('/google/callback', async (c) => {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state');

    if (!code || !state) {
      return c.redirect('/auth/login?error=oauth_failed');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(state)) {
      return c.redirect('/auth/login?error=invalid_state');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID!,
        client_secret: c.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${new URL(c.req.url).origin}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return c.redirect('/auth/login?error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json() as { access_token: string; id_token: string };

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return c.redirect('/auth/login?error=userinfo_failed');
    }

    const googleUser = await userInfoResponse.json() as {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };

    let user = await getUserByEmail(googleUser.email, c.env.DASHBOARD_DB);

    if (!user) {
      const userId = crypto.randomUUID();

      await c.env.DASHBOARD_DB.prepare(`
        INSERT INTO dashboard_users (
          id, email, name, oauth_provider, oauth_id, role, permissions, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        googleUser.email,
        googleUser.name,
        'google',
        googleUser.id,
        'user',
        JSON.stringify([]),
        1
      ).run();

      user = await getUserByEmail(googleUser.email, c.env.DASHBOARD_DB);
      if (!user) {
        return c.redirect('/auth/login?error=user_creation_failed');
      }
    } else {
      await c.env.DASHBOARD_DB.prepare(`
        UPDATE dashboard_users
        SET oauth_provider = ?, oauth_id = ?, last_login_at = datetime('now')
        WHERE id = ?
      `).bind('google', googleUser.id, user.id).run();
    }

    const token = await generateToken(user);

    const userAgent = c.req.header('User-Agent');
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    await createSession(user, c.env.DASHBOARD_DB, userAgent, ipAddress);

    const isNewUser = !user || new Date().getTime() - new Date(user.createdAt).getTime() < 60000;
    return c.redirect(`/pricing?token=${token}&newUser=${isNewUser}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return c.redirect('/auth/login?error=oauth_error');
  }
});

export default googleOAuthRoutes;
