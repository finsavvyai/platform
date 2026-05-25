/**
 * Auth Routes - GitHub OAuth flow
 */

import { Hono } from 'hono';
import '../types';
import {
  generateToken,
  createSession,
  getUserByEmail,
} from '../auth-secure';
import type { Env } from './types';

const githubOAuthRoutes = new Hono<{ Bindings: Env }>();

/** GET /github - Initiate GitHub OAuth flow */
githubOAuthRoutes.get('/github', async (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return c.json({
      error: 'OAuth not configured',
      message: 'GitHub OAuth is not configured on this server',
    }, 503);
  }

  const redirectUri = `${new URL(c.req.url).origin}/auth/github/callback`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

/** GET /github/callback - Handle GitHub OAuth callback */
githubOAuthRoutes.get('/github/callback', async (c) => {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state');

    if (!code || !state) {
      return c.redirect('/auth/login?error=oauth_failed');
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID!,
        client_secret: c.env.GITHUB_CLIENT_SECRET!,
        code,
        redirect_uri: `${new URL(c.req.url).origin}/auth/github/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return c.redirect('/auth/login?error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json() as { access_token: string };

    const userInfoResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'User-Agent': 'AutoBoot',
      },
    });

    if (!userInfoResponse.ok) {
      return c.redirect('/auth/login?error=userinfo_failed');
    }

    const githubUser = await userInfoResponse.json() as {
      id: number;
      email: string;
      name: string;
      login: string;
      avatar_url?: string;
    };

    if (!githubUser.email) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'User-Agent': 'AutoBoot',
        },
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json() as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const primaryEmail = emails.find(e => e.primary && e.verified);
        if (primaryEmail) {
          githubUser.email = primaryEmail.email;
        }
      }
    }

    if (!githubUser.email) {
      return c.redirect('/auth/login?error=email_required');
    }

    let user = await getUserByEmail(githubUser.email, c.env.DASHBOARD_DB);

    if (!user) {
      const userId = crypto.randomUUID();

      await c.env.DASHBOARD_DB.prepare(`
        INSERT INTO dashboard_users (
          id, email, name, oauth_provider, oauth_id, role, permissions, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        githubUser.email,
        githubUser.name || githubUser.login,
        'github',
        githubUser.id.toString(),
        'user',
        JSON.stringify([]),
        1
      ).run();

      user = await getUserByEmail(githubUser.email, c.env.DASHBOARD_DB);
      if (!user) {
        return c.redirect('/auth/login?error=user_creation_failed');
      }
    } else {
      await c.env.DASHBOARD_DB.prepare(`
        UPDATE dashboard_users
        SET oauth_provider = ?, oauth_id = ?, last_login_at = datetime('now')
        WHERE id = ?
      `).bind('github', githubUser.id.toString(), user.id).run();
    }

    const token = await generateToken(user);

    const userAgent = c.req.header('User-Agent');
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    await createSession(user, c.env.DASHBOARD_DB, userAgent, ipAddress);

    const isNewUser = !user || new Date().getTime() - new Date(user.createdAt).getTime() < 60000;
    return c.redirect(`/pricing?token=${token}&newUser=${isNewUser}`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return c.redirect('/auth/login?error=oauth_error');
  }
});

export default githubOAuthRoutes;
