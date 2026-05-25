// Authentication API methods
import type { ApiFetchFn } from './types';

export function createAuthApi(fetchFn: ApiFetchFn) {
  return {
    async login(email: string, password: string) {
      const response = await fetchFn('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }) as Record<string, unknown>;

      const tokens = response.tokens as
        | { accessToken?: string; refreshToken?: string }
        | undefined;
      const accessToken = tokens?.accessToken || response.token;
      const refreshToken = tokens?.refreshToken;

      if (accessToken) {
        localStorage.setItem('access_token', accessToken as string);
        localStorage.setItem('auth_token', accessToken as string);
      }

      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken as string);
      }

      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }

      return response;
    },

    async register(userData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) {
      return fetchFn('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
    },

    async logout() {
      try {
        await fetchFn('/api/auth/logout', {
          method: 'POST',
        });
      } finally {
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }
    },

    async getCurrentUser() {
      return fetchFn('/api/auth/me');
    },

    async refreshToken() {
      const response = await fetchFn('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: localStorage.getItem('refresh_token'),
        }),
      }) as Record<string, unknown>;

      const tokens = response.tokens as
        | { accessToken?: string; refreshToken?: string }
        | undefined;
      const accessToken = tokens?.accessToken || response.token;
      const refreshToken = tokens?.refreshToken;

      if (accessToken) {
        localStorage.setItem('access_token', accessToken as string);
        localStorage.setItem('auth_token', accessToken as string);
      }

      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken as string);
      }

      return response;
    },

    isAuthenticated(): boolean {
      return !!(
        localStorage.getItem('access_token') ||
        localStorage.getItem('auth_token')
      );
    },

    getAuthToken(): string | null {
      return (
        localStorage.getItem('access_token') ||
        localStorage.getItem('auth_token')
      );
    },
  };
}
