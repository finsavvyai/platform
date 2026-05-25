import type { AuthProvider, ProviderConfig } from './types';

export interface AuthorizeArgs {
  provider: AuthProvider;
  config: ProviderConfig;
  redirectUri: string;
  state: string;
}

function set(url: URL, params: Record<string, string>): URL {
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

export function buildAuthorizeUrl({ provider, config, redirectUri, state }: AuthorizeArgs): URL {
  const clientId = config.clientId;
  switch (provider) {
    case 'github':
      return set(new URL('https://github.com/login/oauth/authorize'), {
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'repo,read:user',
        state,
      });
    case 'gitlab': {
      const baseUrl = (config.baseUrl || 'https://gitlab.com').replace(/\/+$/, '');
      return set(new URL(`${baseUrl}/oauth/authorize`), {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'read_user',
        state,
      });
    }
    case 'google':
      return set(new URL('https://accounts.google.com/o/oauth2/v2/auth'), {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
      });
    case 'linkedin':
      return set(new URL('https://www.linkedin.com/oauth/v2/authorization'), {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        state,
      });
    case 'facebook':
      return set(new URL('https://www.facebook.com/v19.0/dialog/oauth'), {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email,public_profile',
        state,
      });
    case 'bitbucket':
      return set(new URL('https://bitbucket.org/site/oauth2/authorize'), {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
      });
    case 'microsoft': {
      const tenantId = config.baseUrl || 'common';
      return set(new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`), {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile User.Read',
        state,
      });
    }
  }
}
