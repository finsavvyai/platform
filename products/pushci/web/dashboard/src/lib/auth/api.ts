import { API_BASE_URL } from '../../config';
import type { AuthProvider, ProviderConfig, User } from './types';

const API = API_BASE_URL;
const AUTH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = AUTH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

const ENV_CLIENT_ID: Record<AuthProvider, string | undefined> = {
  github: import.meta.env.VITE_GITHUB_CLIENT_ID,
  gitlab: import.meta.env.VITE_GITLAB_CLIENT_ID,
  google: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  linkedin: import.meta.env.VITE_LINKEDIN_CLIENT_ID,
  facebook: import.meta.env.VITE_FACEBOOK_CLIENT_ID,
  bitbucket: import.meta.env.VITE_BITBUCKET_CLIENT_ID,
  microsoft: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
};

export async function getProviderConfig(provider: AuthProvider): Promise<ProviderConfig> {
  const envClientId = ENV_CLIENT_ID[provider];
  if (envClientId) return { clientId: envClientId };
  try {
    const res = await fetchWithTimeout(`${API}/api/auth/${provider}/config`);
    if (!res.ok) return { clientId: '' };
    const data = (await res.json()) as ProviderConfig;
    return { clientId: data.clientId ?? '', baseUrl: data.baseUrl };
  } catch {
    return { clientId: '' };
  }
}

export interface ExchangeResult {
  token: string;
  user: User;
}

export async function exchangeCode(provider: AuthProvider, code: string): Promise<ExchangeResult> {
  const res = await fetchWithTimeout(`${API}/api/auth/${provider}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = (await res.json().catch(() => null)) as {
    token?: string;
    user?: User;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(data?.error || `${provider} authentication failed (${res.status})`);
  }
  if (!data?.token || !data.user) {
    throw new Error(data?.error || `${provider} authentication failed: incomplete response`);
  }
  return { token: data.token, user: data.user };
}

export async function verifyToken(token: string): Promise<boolean> {
  const res = await fetchWithTimeout(`${API}/api/user/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}
