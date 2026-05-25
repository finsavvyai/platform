/**
 * OAuth token exchange and profile fetching
 * Separated from providers to stay under 200-line limit
 */

import type { OAuthProviderConfig, OAuthProfile } from './oauth-providers';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  provider: OAuthProviderConfig,
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<TokenResponse>;
}

/**
 * Fetch user profile from provider using access token
 */
export async function fetchUserProfile(
  provider: OAuthProviderConfig,
  accessToken: string,
): Promise<OAuthProfile> {
  const res = await fetch(provider.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user profile (${res.status})`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const profile = provider.getProfile(data);

  // GitHub may not return email in profile; fetch from emails endpoint
  if (!profile.email && provider.userInfoUrl.includes('github')) {
    profile.email = await fetchGitHubEmail(accessToken);
  }

  if (!profile.email) {
    throw new Error('OAuth provider did not return an email address');
  }

  return profile;
}

/**
 * GitHub-specific: fetch primary email from /user/emails
 */
async function fetchGitHubEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'LunaOS-Engine',
    },
  });

  if (!res.ok) return '';

  const emails = (await res.json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;

  const primary = emails.find((e) => e.primary && e.verified);
  return primary?.email ?? emails[0]?.email ?? '';
}
