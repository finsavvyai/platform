import { beforeEach, describe, expect, it } from 'vitest';
import { OAUTH_STATE_KEY } from './storage';
import { consumeOAuthProvider, createOAuthState } from './oauth-state';

beforeEach(() => {
  sessionStorage.clear();
});

describe('createOAuthState', () => {
  it('produces a provider-prefixed nonce and stores it', () => {
    const state = createOAuthState('github');
    expect(state.startsWith('github:')).toBe(true);
    expect(sessionStorage.getItem(OAUTH_STATE_KEY)).toBe(state);
  });

  it('produces a fresh nonce each call', () => {
    const a = createOAuthState('google');
    const b = createOAuthState('google');
    expect(a).not.toBe(b);
  });
});

describe('consumeOAuthProvider', () => {
  it('returns the provider when state matches and clears storage', () => {
    const state = createOAuthState('gitlab');
    expect(consumeOAuthProvider(state)).toBe('gitlab');
    expect(sessionStorage.getItem(OAUTH_STATE_KEY)).toBeNull();
  });

  it('returns null when state is missing from URL', () => {
    createOAuthState('github');
    expect(consumeOAuthProvider(null)).toBeNull();
  });

  it('returns null when state mismatches stored value (CSRF guard)', () => {
    createOAuthState('github');
    expect(consumeOAuthProvider('github:forged')).toBeNull();
  });

  it('returns null when nothing is stored even if URL has a state', () => {
    expect(consumeOAuthProvider('github:something')).toBeNull();
  });

  it('always clears the stored state on consume, even on mismatch', () => {
    createOAuthState('google');
    consumeOAuthProvider('google:wrong');
    expect(sessionStorage.getItem(OAUTH_STATE_KEY)).toBeNull();
  });
});
