import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL, APP_URL } from '../config';

type ScmProvider = 'github' | 'gitlab' | 'bitbucket';

export interface LinkedAccount {
  provider: ScmProvider;
  login: string;
  avatar_url?: string;
  linked_at: string;
}

interface UseLinkedAccountsReturn {
  accounts: LinkedAccount[];
  loading: boolean;
  error: string | null;
  linkAccount: (provider: ScmProvider) => Promise<void>;
  unlinkAccount: (provider: ScmProvider) => Promise<void>;
  refresh: () => Promise<void>;
}

const API = API_BASE_URL;
const TOKEN_KEY = 'pushci_token';
const LINK_STATE_KEY = 'pushci_link_state';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function getProviderClientId(provider: ScmProvider): Promise<string> {
  const envMap: Record<ScmProvider, string | undefined> = {
    github: import.meta.env.VITE_GITHUB_CLIENT_ID,
    gitlab: import.meta.env.VITE_GITLAB_CLIENT_ID,
    bitbucket: import.meta.env.VITE_BITBUCKET_CLIENT_ID,
  };
  if (envMap[provider]) return envMap[provider]!;
  try {
    const res = await fetch(`${API}/api/auth/${provider}/config`);
    if (!res.ok) return '';
    const data = (await res.json()) as { clientId?: string };
    return data.clientId ?? '';
  } catch {
    return '';
  }
}

function buildOAuthUrl(provider: ScmProvider, clientId: string, state: string): string {
  const redirect = APP_URL + '/auth/callback';

  if (provider === 'github') {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirect);
    url.searchParams.set('scope', 'repo,read:user');
    url.searchParams.set('state', state);
    return url.toString();
  }

  if (provider === 'gitlab') {
    const url = new URL('https://gitlab.com/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirect);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'read_user api');
    url.searchParams.set('state', state);
    return url.toString();
  }

  // bitbucket
  const url = new URL('https://bitbucket.org/site/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

export function isLinkCallback(): boolean {
  const stored = sessionStorage.getItem(LINK_STATE_KEY);
  if (!stored) return false;
  const params = new URLSearchParams(window.location.search);
  const state = params.get('state');
  return Boolean(state && state === stored && state.startsWith('link:'));
}

export function consumeLinkCallback(): { provider: ScmProvider; code: string } | null {
  const stored = sessionStorage.getItem(LINK_STATE_KEY);
  sessionStorage.removeItem(LINK_STATE_KEY);
  const params = new URLSearchParams(window.location.search);
  const state = params.get('state');
  const code = params.get('code');
  if (!state || !stored || state !== stored || !code) return null;
  if (!state.startsWith('link:')) return null;
  const parts = state.split(':');
  const provider = parts[1] as ScmProvider;
  if (!['github', 'gitlab', 'bitbucket'].includes(provider)) return null;
  return { provider, code };
}

export function useLinkedAccounts(): UseLinkedAccountsReturn {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/user/linked-accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch linked accounts');
      const data = (await res.json()) as { accounts: LinkedAccount[] };
      setAccounts(data.accounts);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load accounts';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  // Handle link callback on mount
  useEffect(() => {
    const link = consumeLinkCallback();
    if (!link) return;
    const token = getToken();
    if (!token) return;
    window.history.replaceState({}, '', '/settings');
    void (async () => {
      try {
        const res = await fetch(`${API}/api/user/link-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ provider: link.provider, code: link.code }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || 'Linking failed');
        }
        await fetchAccounts();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Linking failed';
        setError(msg);
      }
    })();
  }, [fetchAccounts]);

  const linkAccount = useCallback(async (provider: ScmProvider) => {
    setError(null);
    const clientId = await getProviderClientId(provider);
    if (!clientId) {
      const label = provider.charAt(0).toUpperCase() + provider.slice(1);
      setError(`${label} OAuth is not configured.`);
      return;
    }
    const state = `link:${provider}:${crypto.randomUUID()}`;
    sessionStorage.setItem(LINK_STATE_KEY, state);
    window.location.href = buildOAuthUrl(provider, clientId, state);
  }, []);

  const unlinkAccount = useCallback(async (provider: ScmProvider) => {
    const token = getToken();
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${API}/api/user/linked-accounts/${provider}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to unlink account');
      setAccounts((prev) => prev.filter((a) => a.provider !== provider));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to unlink account';
      setError(msg);
    }
  }, []);

  return { accounts, loading, error, linkAccount, unlinkAccount, refresh: fetchAccounts };
}
