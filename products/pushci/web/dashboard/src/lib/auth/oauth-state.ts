import { OAUTH_STATE_KEY } from './storage';
import { type AuthProvider, parseProviderFromState } from './types';

function randomNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createOAuthState(provider: AuthProvider): string {
  const state = `${provider}:${randomNonce()}`;
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  return state;
}

export function consumeOAuthProvider(state: string | null): AuthProvider | null {
  const stored = sessionStorage.getItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  if (!state || !stored || state !== stored) return null;
  return parseProviderFromState(state);
}
