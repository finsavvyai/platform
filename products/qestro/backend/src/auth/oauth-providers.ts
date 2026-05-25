/**
 * Unified OAuth Provider Registry
 * Single source of truth for all OAuth provider configurations.
 * Consumed by both Hono (Workers) and Express routes.
 */

export interface OAuthProviderConfig {
  id: string;
  name: string;
  displayName: string;
  type: 'oauth2' | 'oidc';
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  /** Environment variable names for client ID and secret */
  envClientId: string;
  envClientSecret: string;
  /** Extra env vars (e.g., tenant ID for Azure) */
  envExtras?: Record<string, string>;
  /** Extra auth params (e.g., access_type for Google) */
  authParams?: Record<string, string>;
  /** Token endpoint uses form-urlencoded (vs JSON) */
  tokenFormEncoded: boolean;
  /**
   * Skip PKCE for this provider. Use when the provider is a strict OIDC
   * implementation that rejects client_secret + code_verifier combos AND
   * PKCE state wouldn't survive Cloudflare Workers isolate boundaries.
   * Confidential clients (those with client_secret) are still secure without PKCE.
   */
  noPkce?: boolean;
  /** Headers for user info request */
  userInfoHeaders?: Record<string, string>;
  /** Extract user from provider's user info response */
  extractUser: (data: Record<string, unknown>) => OAuthUser;
  /** User ID prefix (e.g., "gh-" for GitHub) */
  idPrefix: string;
  /** SVG icon path for the login button */
  iconSvg: string;
  /** Brand color for UI */
  brandColor: string;
}

export interface OAuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

// ─── Provider Definitions ──────────────────────────────────

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  github: {
    id: 'github',
    name: 'GitHub',
    displayName: 'GitHub',
    type: 'oauth2',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email', 'read:user'],
    envClientId: 'GITHUB_OAUTH_CLIENT_ID',
    envClientSecret: 'GITHUB_OAUTH_CLIENT_SECRET',
    tokenFormEncoded: false,
    userInfoHeaders: { 'User-Agent': 'Qestro' },
    extractUser: (data) => ({
      id: String(data.id),
      email: (data.email as string) || '',
      name: (data.name as string) || (data.login as string) || '',
      avatar: data.avatar_url as string,
    }),
    idPrefix: 'gh-',
    iconSvg: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z',
    brandColor: '#333333',
  },

  google: {
    id: 'google',
    name: 'Google',
    displayName: 'Google',
    type: 'oidc',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
    envClientId: 'GOOGLE_OAUTH_CLIENT_ID',
    envClientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    authParams: { access_type: 'offline', prompt: 'consent' },
    tokenFormEncoded: true,
    extractUser: (data) => ({
      id: data.sub as string,
      email: data.email as string,
      name: (data.name as string) || '',
      avatar: data.picture as string,
    }),
    idPrefix: 'google-',
    iconSvg: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z',
    brandColor: '#4285F4',
  },

  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    displayName: 'Microsoft',
    type: 'oidc',
    authUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    envClientId: 'AZURE_OAUTH_CLIENT_ID',
    envClientSecret: 'AZURE_OAUTH_CLIENT_SECRET',
    envExtras: { AZURE_TENANT_ID: 'common' },
    authParams: { response_mode: 'query' },
    tokenFormEncoded: true,
    extractUser: (data) => ({
      id: data.id as string,
      email: (data.mail as string) || (data.userPrincipalName as string) || '',
      name: (data.displayName as string) || '',
    }),
    idPrefix: 'ms-',
    iconSvg: 'M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z',
    brandColor: '#00A4EF',
  },

  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    displayName: 'LinkedIn',
    type: 'oidc',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scopes: ['openid', 'profile', 'email'],
    envClientId: 'LINKEDIN_OAUTH_CLIENT_ID',
    envClientSecret: 'LINKEDIN_OAUTH_CLIENT_SECRET',
    tokenFormEncoded: true,
    noPkce: true,
    extractUser: (data) => ({
      id: data.sub as string,
      email: data.email as string,
      name: (data.name as string) || '',
      avatar: data.picture as string,
    }),
    idPrefix: 'li-',
    iconSvg: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    brandColor: '#0A66C2',
  },

  discord: {
    id: 'discord',
    name: 'Discord',
    displayName: 'Discord',
    type: 'oauth2',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scopes: ['identify', 'email'],
    envClientId: 'DISCORD_OAUTH_CLIENT_ID',
    envClientSecret: 'DISCORD_OAUTH_CLIENT_SECRET',
    tokenFormEncoded: true,
    extractUser: (data) => ({
      id: data.id as string,
      email: data.email as string,
      name: (data.global_name as string) || (data.username as string) || '',
      avatar: data.avatar
        ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
        : undefined,
    }),
    idPrefix: 'dc-',
    iconSvg: 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z',
    brandColor: '#5865F2',
  },

};

/**
 * Resolve tenant-specific URLs (e.g., Azure AD)
 */
export function resolveProviderUrl(
  url: string,
  env: Record<string, string>,
): string {
  return url.replace('{tenant}', env.AZURE_TENANT_ID || 'common');
}

/**
 * Get enabled providers based on available env vars
 */
export function getEnabledProviders(
  env: Record<string, string>,
): OAuthProviderConfig[] {
  return Object.values(OAUTH_PROVIDERS).filter(
    (p) => !!env[p.envClientId],
  );
}
