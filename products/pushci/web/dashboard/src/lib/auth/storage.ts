import type { User } from './types';

export const TOKEN_KEY = 'pushci_token';
export const USER_KEY = 'pushci_user';
export const OAUTH_STATE_KEY = 'pushci_oauth_state';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function persistSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
}
