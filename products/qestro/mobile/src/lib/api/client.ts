import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8001';

let refreshPromise: Promise<boolean> | null = null;

async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('access_token');
  } catch {
    return null;
  }
}

async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('refresh_token');
  } catch {
    return null;
  }
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync('access_token', access);
  await SecureStore.setItemAsync('refresh_token', refresh);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;

    const data = await res.json();
    if (data.tokens) {
      await setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const token = await getToken();

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      return apiFetch<T>(endpoint, options);
    }
    await clearTokens();
    throw new ApiError('Session expired', 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed: ${res.status}`, res.status);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getWebSocketURL(path: string): string {
  return `${WS_URL}${path}`;
}

export { API_URL, WS_URL };
