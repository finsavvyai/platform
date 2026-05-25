import { describe, it, expect } from 'vitest';
import { toSetCookie, clearCookie } from './cookies.js';

describe('toSetCookie', () => {
  it('formats a CookieDescriptor into a Set-Cookie line', () => {
    const line = toSetCookie({
      name: 'tf_bound',
      value: 'abc123',
      max_age: 300,
      attributes: 'Secure;HttpOnly;SameSite=Lax;Path=/',
    });
    expect(line).toBe('tf_bound=abc123; Max-Age=300; Secure;HttpOnly;SameSite=Lax;Path=/');
  });
});

describe('clearCookie', () => {
  it('produces a Max-Age=0 expiry header', () => {
    expect(clearCookie('tf_bound')).toContain('Max-Age=0');
    expect(clearCookie('tf_bound')).toContain('HttpOnly');
  });
});
