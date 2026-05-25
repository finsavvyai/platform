/**
 * Token utility functions for JWT management and refresh
 */

import axios from 'axios';

export function parseJWT(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

export function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = parseJWT(token);
    const expirationTime = (payload.exp as number) * 1000;
    return expirationTime - Date.now() < 5 * 60 * 1000;
  } catch {
    return false;
  }
}

export async function refreshAuthToken(
  apiBaseUrl: string,
  getRefreshPromise: () => Promise<string> | null,
  setRefreshPromise: (p: Promise<string> | null) => void,
): Promise<string> {
  const existing = getRefreshPromise();
  if (existing) return existing;

  const promise = (async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) throw new Error('No refresh token available');
    try {
      const response = await axios.post(`${apiBaseUrl}/api/v1/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data.data;
      localStorage.setItem('auth_token', accessToken);
      if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);
      return accessToken as string;
    } finally {
      setRefreshPromise(null);
    }
  })();

  setRefreshPromise(promise);
  return promise;
}
