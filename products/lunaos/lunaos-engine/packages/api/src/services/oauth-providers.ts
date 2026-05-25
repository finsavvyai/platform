/**
 * OAuth provider configurations for social login
 * Supports: Google, GitHub, Microsoft
 */

export interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  getProfile(data: Record<string, unknown>): OAuthProfile;
}

export interface OAuthProfile {
  email: string;
  name: string;
  avatarUrl?: string;
  providerId: string;
}

type ProviderName = 'google' | 'github' | 'microsoft' | 'linkedin';

/** Google OAuth 2.0 configuration */
const google: OAuthProviderConfig = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  scopes: ['openid', 'email', 'profile'],
  getProfile(data) {
    return {
      email: String(data.email ?? ''),
      name: String(data.name ?? ''),
      avatarUrl: data.picture ? String(data.picture) : undefined,
      providerId: String(data.id ?? ''),
    };
  },
};

/** GitHub OAuth configuration */
const github: OAuthProviderConfig = {
  authUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userInfoUrl: 'https://api.github.com/user',
  scopes: ['read:user', 'user:email'],
  getProfile(data) {
    return {
      email: String(data.email ?? ''),
      name: String(data.name ?? data.login ?? ''),
      avatarUrl: data.avatar_url ? String(data.avatar_url) : undefined,
      providerId: String(data.id ?? ''),
    };
  },
};

/** Microsoft (Azure AD) OAuth 2.0 configuration */
const microsoft: OAuthProviderConfig = {
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
  scopes: ['openid', 'email', 'profile'],
  getProfile(data) {
    return {
      email: String(data.mail ?? data.userPrincipalName ?? ''),
      name: String(data.displayName ?? ''),
      avatarUrl: undefined,
      providerId: String(data.id ?? ''),
    };
  },
};

/** LinkedIn OAuth 2.0 (OpenID Connect) configuration */
const linkedin: OAuthProviderConfig = {
  authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
  scopes: ['openid', 'profile', 'email'],
  getProfile(data) {
    return {
      email: String(data.email ?? ''),
      name: String(data.name ?? ''),
      avatarUrl: data.picture ? String(data.picture) : undefined,
      providerId: String(data.sub ?? ''),
    };
  },
};

const providers: Record<ProviderName, OAuthProviderConfig> = {
  google,
  github,
  microsoft,
  linkedin,
};

/**
 * Check if a string is a valid provider name
 */
export function isValidProvider(name: string): name is ProviderName {
  return name in providers;
}

/**
 * Get provider config by name
 * @throws if provider name is invalid
 */
export function getProvider(name: string): OAuthProviderConfig {
  if (!isValidProvider(name)) {
    throw new Error(`Unsupported OAuth provider: ${name}`);
  }
  return providers[name];
}

/**
 * Get client credentials for a provider from env bindings
 */
export function getClientCredentials(
  provider: string,
  env: Record<string, string | undefined>,
): { clientId: string; clientSecret: string } {
  const upper = provider.toUpperCase();
  const clientId = env[`${upper}_CLIENT_ID`];
  const clientSecret = env[`${upper}_CLIENT_SECRET`];

  if (!clientId || !clientSecret) {
    throw new Error(`Missing ${upper}_CLIENT_ID or ${upper}_CLIENT_SECRET`);
  }

  return { clientId, clientSecret };
}

/**
 * Build the authorization redirect URL for a provider
 */
export function buildAuthUrl(
  provider: OAuthProviderConfig,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    state,
  });

  return `${provider.authUrl}?${params.toString()}`;
}
