import { describe, expect, it } from 'vitest';
import {
  ALL_PROVIDERS,
  isAuthProvider,
  parseProviderFromState,
  providerLabel,
} from './types';

describe('isAuthProvider', () => {
  it('accepts all known providers', () => {
    for (const p of ALL_PROVIDERS) expect(isAuthProvider(p)).toBe(true);
  });
  it('rejects unknown and falsy values', () => {
    expect(isAuthProvider('twitter')).toBe(false);
    expect(isAuthProvider('')).toBe(false);
    expect(isAuthProvider(null)).toBe(false);
    expect(isAuthProvider(undefined)).toBe(false);
  });
});

describe('parseProviderFromState', () => {
  it('extracts the provider prefix before the colon', () => {
    expect(parseProviderFromState('github:abc123')).toBe('github');
    expect(parseProviderFromState('microsoft:nonce')).toBe('microsoft');
  });
  it('returns null for empty or malformed state', () => {
    expect(parseProviderFromState(null)).toBeNull();
    expect(parseProviderFromState('')).toBeNull();
    expect(parseProviderFromState('unknown:abc')).toBeNull();
  });
});

describe('providerLabel', () => {
  it('capitalizes provider identifier', () => {
    expect(providerLabel('github')).toBe('Github');
    expect(providerLabel('linkedin')).toBe('Linkedin');
  });
});
