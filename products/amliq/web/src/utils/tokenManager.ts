const TOKEN_KEY = 'amliq_token';

export const tokenManager = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => { localStorage.setItem(TOKEN_KEY, token); },
  clear: (): void => { localStorage.removeItem(TOKEN_KEY); },
  getAuthHeader: (): Record<string, string> => {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};
