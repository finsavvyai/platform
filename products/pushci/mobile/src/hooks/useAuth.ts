import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import * as SecureStore from '../lib/secureStore';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_BASE_URL, APP_URL } from '../config';
import { authenticate as bioAuth, isBiometricAvailable } from '../lib/biometric';

const TOKEN_KEY = 'pushci_token';
const USER_KEY = 'pushci_user';
const BIO_ENABLED_KEY = 'pushci_bio_enabled';

export interface User {
  login: string;
  avatar_url: string;
  name: string;
  provider?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  locked: boolean;
  loginWithGitHub: () => void;
  loginWithGitLab: () => void;
  unlockWithBiometric: () => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null, token: null, loading: true, error: null, locked: false,
  loginWithGitHub: () => {}, loginWithGitLab: () => {},
  unlockWithBiometric: async () => {},
  logout: () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function useAuthLoader(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [pendingSession, setPendingSession] = useState<{ token: string; user: User } | null>(null);

  async function verifyAndActivate(candidateToken: string, candidateUser: User): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${candidateToken}` },
      });
      if (!res.ok) { await clearSession(); return false; }
      setUser(candidateUser); setToken(candidateToken); setLocked(false);
      return true;
    } catch { await clearSession(); return false; }
  }

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      const raw = await SecureStore.getItemAsync(USER_KEY);
      const bioFlag = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
      if (stored && raw) {
        try {
          const parsed = JSON.parse(raw) as User;
          const bioReady = bioFlag === '1' && await isBiometricAvailable();
          if (bioReady) {
            // Hold the session behind Face ID — don't touch the API until unlocked.
            setPendingSession({ token: stored, user: parsed });
            setLocked(true);
            setLoading(false);
            return;
          }
          await verifyAndActivate(stored, parsed);
        } catch { await clearSession(); }
      }
      setLoading(false);
    })();
  }, []);

  async function clearSession() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
    setUser(null); setToken(null); setLocked(false); setPendingSession(null);
  }

  const unlockWithBiometric = useCallback(async () => {
    if (!pendingSession) return;
    setError(null);
    const result = await bioAuth('Unlock PushCI');
    if (!result.ok) {
      if (result.reason === 'unavailable' || result.reason === 'not_enrolled') {
        // No biometrics on this device — fall through so the user can OAuth.
        await clearSession();
        return;
      }
      setError(result.reason === 'cancelled' ? 'Unlock cancelled' : 'Face ID failed');
      return;
    }
    const ok = await verifyAndActivate(pendingSession.token, pendingSession.user);
    if (ok) setPendingSession(null);
  }, [pendingSession]);

  const startOAuth = useCallback(async (provider: 'github' | 'gitlab') => {
    setError(null);
    // OAuth apps don't accept custom URL schemes (pushci://), so we use the
    // web callback URL which is registered with GitHub/GitLab. The web
    // callback detects state=mobile and redirects to pushci://auth/callback
    // which WebBrowser intercepts via the returnUrl below.
    const webRedirect = `${APP_URL}/auth/callback`;
    const appReturnUrl = Linking.createURL('auth/callback');
    const state = `mobile:${Math.random().toString(36).slice(2, 10)}`;
    try {
      const cfgRes = await fetch(`${API_BASE_URL}/api/auth/${provider}/config`);
      const cfg = await cfgRes.json() as { clientId?: string };
      if (!cfg.clientId) { setError(`${provider} OAuth not configured`); return; }
      const urls: Record<string, string> = {
        github: `https://github.com/login/oauth/authorize?client_id=${cfg.clientId}&redirect_uri=${encodeURIComponent(webRedirect)}&scope=repo,read:user&state=${encodeURIComponent(state)}`,
        gitlab: `https://gitlab.com/oauth/authorize?client_id=${cfg.clientId}&redirect_uri=${encodeURIComponent(webRedirect)}&response_type=code&scope=read_user&state=${encodeURIComponent(state)}`,
      };
      const result = await WebBrowser.openAuthSessionAsync(urls[provider], appReturnUrl, {
        preferEphemeralSession: true,
      });
      if (result.type !== 'success') return;
      const code = new URL(result.url).searchParams.get('code');
      if (!code) { setError('No auth code received'); return; }
      const res = await fetch(`${API_BASE_URL}/api/auth/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json() as { token?: string; user?: User; error?: string };
      if (data.token && data.user) {
        await SecureStore.setItemAsync(TOKEN_KEY, data.token);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
        // Opt into Face ID unlock if the device supports it so the next cold
        // start doesn't round-trip through GitHub OAuth again.
        if (await isBiometricAvailable()) {
          await SecureStore.setItemAsync(BIO_ENABLED_KEY, '1');
        }
        setToken(data.token); setUser(data.user); setLocked(false);
      } else { setError(data.error || 'Login failed'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
  }, []);

  return {
    user, token, loading, error, locked,
    loginWithGitHub: () => { void startOAuth('github'); },
    loginWithGitLab: () => { void startOAuth('gitlab'); },
    unlockWithBiometric,
    logout: () => { void logout(); },
  };
}
