import { useState, useEffect } from 'react';
import { APP_URL } from '../config';
import { AUTH_EXPIRED_EVENT } from '../lib/api-errors';
import {
  exchangeCode,
  getProviderConfig,
  verifyToken,
} from '../lib/auth/api';
import { consumeOAuthProvider, createOAuthState } from '../lib/auth/oauth-state';
import { buildAuthorizeUrl } from '../lib/auth/providers';
import {
  clearSession,
  getStoredToken,
  persistSession,
  readStoredUser,
} from '../lib/auth/storage';
import {
  ALL_PROVIDERS,
  type AuthProvider,
  type ProviderAvailability,
  type User,
  providerLabel,
} from '../lib/auth/types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_AVAILABILITY: ProviderAvailability = {
  github: false, gitlab: false, google: false, linkedin: false,
  facebook: false, bitbucket: false, microsoft: false,
};

function envAvailability(): ProviderAvailability {
  return {
    github: Boolean(import.meta.env.VITE_GITHUB_CLIENT_ID),
    gitlab: Boolean(import.meta.env.VITE_GITLAB_CLIENT_ID),
    google: Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID),
    linkedin: Boolean(import.meta.env.VITE_LINKEDIN_CLIENT_ID),
    facebook: Boolean(import.meta.env.VITE_FACEBOOK_CLIENT_ID),
    bitbucket: Boolean(import.meta.env.VITE_BITBUCKET_CLIENT_ID),
    microsoft: Boolean(import.meta.env.VITE_MICROSOFT_CLIENT_ID),
  };
}

export interface UseAuthValue extends AuthState {
  providers: ProviderAvailability;
  loginWithGitHub: () => void;
  loginWithGitLab: () => void;
  loginWithGoogle: () => void;
  loginWithLinkedIn: () => void;
  loginWithFacebook: () => void;
  loginWithBitbucket: () => void;
  loginWithMicrosoft: () => void;
  logout: () => void;
}

export function useAuth(): UseAuthValue {
  const [state, setState] = useState<AuthState>({
    user: readStoredUser(),
    token: getStoredToken(),
    loading: true,
    error: null,
  });
  const [providers, setProviders] = useState<ProviderAvailability>(envAvailability());

  useEffect(() => {
    void loadProviderAvailability().then(setProviders);

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const stateParam = params.get('state');
    const provider = consumeOAuthProvider(stateParam);
    if (code) {
      if (provider) {
        void completeExchange(provider, code, setState);
      } else {
        window.history.replaceState({}, '', '/login');
        clearSession();
        setState({ user: null, token: null, loading: false, error: 'Invalid OAuth state. Please try again.' });
      }
      return undefined;
    }

    const token = getStoredToken();
    const user = readStoredUser();
    if (token && user) {
      verifyToken(token)
        .then((ok) => {
          if (ok) {
            setState({ user, token, loading: false, error: null });
          } else {
            clearSession();
            setState({ user: null, token: null, loading: false, error: null });
          }
        })
        .catch(() => {
          clearSession();
          setState({
            user: null, token: null, loading: false,
            error: 'Could not reach PushCI to verify your session. Please sign in again.',
          });
        });
    } else {
      setState({ user: null, token: null, loading: false, error: null });
    }

    const handleAuthExpired = () => {
      clearSession();
      setState({
        user: null, token: null, loading: false,
        error: 'Your session expired. Please sign in again.',
      });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  function logout() {
    clearSession();
    setState({ user: null, token: null, loading: false, error: null });
  }

  async function startLogin(provider: AuthProvider) {
    setState((current) => ({ ...current, error: null }));
    const config = await getProviderConfig(provider);
    if (!config.clientId) {
      setState((current) => ({
        ...current,
        error: `${providerLabel(provider)} OAuth is not configured.`,
      }));
      return;
    }
    const state = createOAuthState(provider);
    const url = buildAuthorizeUrl({
      provider,
      config,
      redirectUri: `${APP_URL}/auth/callback`,
      state,
    });
    window.location.href = url.toString();
  }

  return {
    ...state,
    providers,
    loginWithGitHub: () => { void startLogin('github'); },
    loginWithGitLab: () => { void startLogin('gitlab'); },
    loginWithGoogle: () => { void startLogin('google'); },
    loginWithLinkedIn: () => { void startLogin('linkedin'); },
    loginWithFacebook: () => { void startLogin('facebook'); },
    loginWithBitbucket: () => { void startLogin('bitbucket'); },
    loginWithMicrosoft: () => { void startLogin('microsoft'); },
    logout,
  };
}

async function loadProviderAvailability(): Promise<ProviderAvailability> {
  const entries = await Promise.all(
    ALL_PROVIDERS.map(async (p) => [p, Boolean((await getProviderConfig(p)).clientId)] as const),
  );
  return entries.reduce<ProviderAvailability>((acc, [p, ok]) => {
    acc[p] = ok;
    return acc;
  }, { ...EMPTY_AVAILABILITY });
}

async function completeExchange(
  provider: AuthProvider,
  code: string,
  setState: (s: AuthState) => void,
): Promise<void> {
  try {
    const { token, user } = await exchangeCode(provider, code);
    persistSession(token, user);
    window.history.replaceState({}, '', '/');
    setState({ user, token, loading: false, error: null });
  } catch (err) {
    const fallback = `${providerLabel(provider)} login failed. Please try again.`;
    const message = err instanceof Error && err.message ? err.message : fallback;
    window.history.replaceState({}, '', '/login');
    clearSession();
    setState({ user: null, token: null, loading: false, error: message });
  }
}
