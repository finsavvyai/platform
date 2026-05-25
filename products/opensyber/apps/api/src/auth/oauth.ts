/**
 * OAuth2 provider implementation for Google and GitHub.
 * Creates authorization URLs and exchanges authorization codes for access tokens.
 */

import type { OAuth2Config, OAuth2Provider, AuthUser } from './types.js';

export class OAuth2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuth2Error';
  }
}

export class GoogleOAuth2Provider implements OAuth2Provider {
  private config: OAuth2Config;
  private authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private tokenUrl = 'https://oauth2.googleapis.com/token';
  private userInfoUrl = 'https://www.googleapis.com/oauth2/v1/userinfo';

  constructor(config: OAuth2Config) {
    if (config.provider !== 'google') throw new OAuth2Error('Invalid provider');
    this.config = config;
  }

  getAuthURL(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });
    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; user: Partial<AuthUser> }> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.redirectUri,
    });

    const tokenRes = await fetch(this.tokenUrl, { method: 'POST', body });
    if (!tokenRes.ok) throw new OAuth2Error('Token exchange failed');

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch(this.userInfoUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) throw new OAuth2Error('Failed to fetch user info');

    const userInfo = (await userRes.json()) as { email: string; name: string };
    return {
      accessToken: access_token,
      user: { email: userInfo.email, name: userInfo.name, role: 'user' },
    };
  }
}

export class GitHubOAuth2Provider implements OAuth2Provider {
  private config: OAuth2Config;
  private authUrl = 'https://github.com/login/oauth/authorize';
  private tokenUrl = 'https://github.com/login/oauth/access_token';
  private userInfoUrl = 'https://api.github.com/user';

  constructor(config: OAuth2Config) {
    if (config.provider !== 'github') throw new OAuth2Error('Invalid provider');
    this.config = config;
  }

  getAuthURL(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'read:user user:email',
      state,
    });
    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; user: Partial<AuthUser> }> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
    });

    const tokenRes = await fetch(this.tokenUrl, {
      method: 'POST',
      body,
      headers: { Accept: 'application/json' },
    });
    if (!tokenRes.ok) throw new OAuth2Error('Token exchange failed');

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch(this.userInfoUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) throw new OAuth2Error('Failed to fetch user info');

    const userInfo = (await userRes.json()) as { email: string; name: string };
    return {
      accessToken: access_token,
      user: { email: userInfo.email, name: userInfo.name, role: 'user' },
    };
  }
}

export function createOAuth2Provider(config: OAuth2Config): OAuth2Provider {
  if (config.provider === 'google') return new GoogleOAuth2Provider(config);
  if (config.provider === 'github') return new GitHubOAuth2Provider(config);
  throw new OAuth2Error(`Unsupported provider: ${config.provider}`);
}
