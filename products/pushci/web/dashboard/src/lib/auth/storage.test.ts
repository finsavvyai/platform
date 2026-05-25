import { beforeEach, describe, expect, it } from 'vitest';
import {
  OAUTH_STATE_KEY,
  TOKEN_KEY,
  USER_KEY,
  clearSession,
  getStoredToken,
  persistSession,
  readStoredUser,
} from './storage';

const sampleUser = { login: 'alice', avatar_url: 'a', name: 'Alice' };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('storage', () => {
  it('returns null when no user is stored', () => {
    expect(readStoredUser()).toBeNull();
  });

  it('reads back a persisted user', () => {
    persistSession('tok', sampleUser);
    expect(getStoredToken()).toBe('tok');
    expect(readStoredUser()).toEqual(sampleUser);
  });

  it('drops malformed user JSON instead of throwing', () => {
    localStorage.setItem(USER_KEY, '{not json');
    expect(readStoredUser()).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('clearSession removes token, user, and oauth state', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    localStorage.setItem(USER_KEY, JSON.stringify(sampleUser));
    sessionStorage.setItem(OAUTH_STATE_KEY, 'github:nonce');
    clearSession();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(sessionStorage.getItem(OAUTH_STATE_KEY)).toBeNull();
  });
});
