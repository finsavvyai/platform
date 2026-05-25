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

  it('issuedAt and expiresAt are ISO 8601 strings parseable by Date', async () => {
    const c = await issueBoundCookie();
    expect(c.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(c.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Number.isFinite(new Date(c.issuedAt).getTime())).toBe(true);
    expect(Number.isFinite(new Date(c.expiresAt).getTime())).toBe(true);
  });

  it('cookie value encodes exactly 32 random bytes (43 base64url chars, no padding)', async () => {
    const c = await issueBoundCookie();
    expect(c.value).toHaveLength(43);
    expect(c.value).not.toContain('=');
    expect(c.value).not.toContain('+');
    expect(c.value).not.toContain('/');
  });

  it('BOUND_COOKIE_NAME is the canonical "__Secure-tf-bound" string', () => {
    expect(BOUND_COOKIE_NAME).toBe('__Secure-tf-bound');
  });

  it('different TLS exporters produce different hashes (per-connection binding)', async () => {
    const a = await hashBoundCookie('same-cookie-value', 'connection-A-exporter-hex');
    const b = await hashBoundCookie('same-cookie-value', 'connection-B-exporter-hex');
    expect(a).not.toBe(b);
  });

  it('setBoundCookieHeader leads with name=value (RFC 6265 cookie format)', async () => {
    const c = await issueBoundCookie();
    const header = setBoundCookieHeader(c);
    expect(header.startsWith(`__Secure-tf-bound=${c.value};`)).toBe(true);
  });

  it('issueBoundCookie + hashBoundCookie roundtrip honors tlsExporterHex (server can re-verify)', async () => {
    const exporter = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
    const c = await issueBoundCookie({ tlsExporterHex: exporter });
    // Server stores c.hash. On refresh, client re-presents c.value;
    // server re-derives the hash with the SAME exporter — must match.
    const reHashed = await hashBoundCookie(c.value, exporter);
    expect(reHashed).toBe(c.hash);
    // Same value with a DIFFERENT exporter must NOT match (replay across
    // a different TLS connection is rejected).
    const wrongExporter = await hashBoundCookie(c.value, '00000000000000000000000000000000');
    expect(wrongExporter).not.toBe(c.hash);
  });

  it('hash is 43 base64url chars (SHA-256 = 32 bytes → 43 b64url, no padding)', async () => {
    const c = await issueBoundCookie();
    expect(c.hash).toHaveLength(43);
    expect(c.hash).not.toContain('=');
    expect(c.hash).not.toContain('+');
    expect(c.hash).not.toContain('/');
  });

  it('issueBoundCookie WITHOUT exporter then hashBoundCookie WITH exporter does NOT match (rotation safety)', async () => {
    // A cookie issued in a non-exporter-aware runtime (workerd) and later
    // re-hashed in an exporter-aware runtime must NOT validate — the
    // hash format is dependent on exporter presence at issue time.
    const c = await issueBoundCookie();
    const withExporter = await hashBoundCookie(c.value, 'aabbccddeeff');
    expect(withExporter).not.toBe(c.hash);
  });

  it('Sprint 37 line 115: rotation extends — second issuance has expiresAt > first (refresh pushes the 5-min window forward)', async () => {
    // The "refresh extends it" half of Sprint 37 line 115. Both issuances
    // carry the 300s TTL, but the SECOND one's expiresAt is strictly later
    // because issueBoundCookie reads `new Date()` at call time. Pinning
    // monotonic forward motion locks the contract that refresh produces
    // a fresh expiry rather than reusing a cached one.
    const a = await issueBoundCookie();
    await new Promise((r) => setTimeout(r, 5));
    const b = await issueBoundCookie();
    expect(new Date(b.expiresAt).getTime()).toBeGreaterThan(new Date(a.expiresAt).getTime());
    expect(a.maxAgeSeconds).toBe(300);
    expect(b.maxAgeSeconds).toBe(300);
  });
});
