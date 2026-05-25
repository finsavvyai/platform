import { describe, it, expect } from 'vitest';
import {
  issueBoundCookie,
  hashBoundCookie,
  setBoundCookieHeader,
  BOUND_COOKIE_NAME,
} from './bound-cookie.js';

describe('issueBoundCookie', () => {
  it('returns a base64url value and a SHA-256 hash', async () => {
    const c = await issueBoundCookie();
    expect(c.value).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(c.hash).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(c.value).not.toBe(c.hash);
  });

  it('defaults to 300-second Max-Age', async () => {
    const c = await issueBoundCookie();
    expect(c.maxAgeSeconds).toBe(300);
    const ttlMs = new Date(c.expiresAt).getTime() - new Date(c.issuedAt).getTime();
    expect(ttlMs).toBe(300_000);
  });

  it('honours custom maxAgeSeconds', async () => {
    const c = await issueBoundCookie({ maxAgeSeconds: 60 });
    expect(c.maxAgeSeconds).toBe(60);
  });

  it('produces a hash that hashBoundCookie reproduces deterministically', async () => {
    const c = await issueBoundCookie();
    const reHashed = await hashBoundCookie(c.value);
    expect(reHashed).toBe(c.hash);
  });

  it('mixes TLS exporter into the hash when provided', async () => {
    const noExp = await hashBoundCookie('abc');
    const withExp = await hashBoundCookie('abc', 'deadbeef');
    expect(noExp).not.toBe(withExp);
  });

  it('emits a Secure HttpOnly SameSite=Strict header', async () => {
    const c = await issueBoundCookie({ maxAgeSeconds: 120 });
    const header = setBoundCookieHeader(c);
    expect(header).toContain(`${BOUND_COOKIE_NAME}=${c.value}`);
    expect(header).toContain('Max-Age=120');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/');
  });

  it('returns different values across two issuances', async () => {
    const a = await issueBoundCookie();
    const b = await issueBoundCookie();
    expect(a.value).not.toBe(b.value);
    expect(a.hash).not.toBe(b.hash);
  });
});
