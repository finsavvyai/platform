import { useState, useEffect } from 'react';

interface User {
  login: string;
  avatar_url: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

const API = import.meta.env.VITE_API_URL || 'https://pushci-api.workers.dev';

export function useAuth(): AuthState & { login: () => void; logout: () => void } {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('pushci_token'),
    loading: true,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      exchangeCode(code);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (state.token) {
      fetchUser(state.token);
    } else {
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  async function exchangeCode(code: string) {
    const res = await fetch(`${API}/api/auth/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('pushci_token', data.token);
      setState({ user: data.user, token: data.token, loading: false });
    }
  }

  async function fetchUser(token: string) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        setState({ user, token, loading: false });
      } else {
        logout();
      }
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  }

  function login() {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      console.error('VITE_GITHUB_CLIENT_ID is not configured');
      return;
    }
    const redirect = encodeURIComponent(window.location.origin + '/auth/callback');
    window.location.href =
      `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect}&scope=repo,read:user`;
  }

  function logout() {
    localStorage.removeItem('pushci_token');
    setState({ user: null, token: null, loading: false });
  }

  return { ...state, login, logout };
}
