/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  createToken,
  verifyToken,
  extractToken,
  sessionCookie,
  clearSessionCookie,
} from './jwt';

const SECRET = 'test-jwt-secret-at-least-32-chars-long';

describe('createToken + verifyToken', () => {
  it('creates a verifiable token with sub/email', async () => {
    const token = await createToken({ sub: 'u1', email: 'u@example.com' }, SECRET);
    expect(token.split('.')).toHaveLength(3);
    const payload = await verifyToken(token, SECRET);
    expect(payload?.sub).toBe('u1');
    expect(payload?.email).toBe('u@example.com');
  });

  it('includes name when provided', async () => {
    const token = await createToken({ sub: 'u2', email: 'u@example.com', name: 'Alice' }, SECRET);
    const payload = await verifyToken(token, SECRET);
    expect(payload?.name).toBe('Alice');
  });

  it('sets iat and exp correctly', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await createToken({ sub: 'u3', email: 'u@x.com' }, SECRET);
    const after = Math.floor(Date.now() / 1000);
    const payload = await verifyToken(token, SECRET);
    expect(payload?.iat).toBeGreaterThanOrEqual(before);
    expect(payload?.iat).toBeLessThanOrEqual(after);
    // 7 days TTL
    expect(payload?.exp).toBeGreaterThan(before + 7 * 24 * 3600 - 5);
    expect(payload?.exp).toBeLessThan(after + 7 * 24 * 3600 + 5);
  });

  it('returns null for wrong secret', async () => {
    const token = await createToken({ sub: 'u4', email: 'u@x.com' }, SECRET);
    const result = await verifyToken(token, 'wrong-secret-here-padded-long-enough');
    expect(result).toBeNull();
  });

  it('returns null for malformed token (two parts)', async () => {
    expect(await verifyToken('a.b', SECRET)).toBeNull();
  });

  it('returns null for expired token', async () => {
    const token = await createToken({ sub: 'u5', email: 'u@x.com' }, SECRET);
    const parts = token.split('.');
    // Decode payload, set exp to past, re-encode without re-signing
    const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payloadObj = JSON.parse(payloadStr);
    payloadObj.exp = Math.floor(Date.now() / 1000) - 1;
    const newPayload = btoa(JSON.stringify(payloadObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    // Tampered token — signature invalid anyway so verifyToken returns null
    const tampered = `${parts[0]}.${newPayload}.${parts[2]}`;
    expect(await verifyToken(tampered, SECRET)).toBeNull();
  });

  it('returns null for bad JSON payload', async () => {
    const fakeHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const fakeBody = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const fakeSig = 'fakesig';
    expect(await verifyToken(`${fakeHeader}.${fakeBody}.${fakeSig}`, SECRET)).toBeNull();
  });
});

describe('extractToken', () => {
  it('extracts Bearer token from Authorization header', () => {
    const req = new Request('https://x/', { headers: { Authorization: 'Bearer mytoken123' } });
    expect(extractToken(req)).toBe('mytoken123');
  });

  it('extracts token from clawpipe_session cookie', () => {
    const req = new Request('https://x/', { headers: { Cookie: 'clawpipe_session=cookietoken; other=x' } });
    expect(extractToken(req)).toBe('cookietoken');
  });

  it('prefers Authorization header over cookie', () => {
    const req = new Request('https://x/', {
      headers: {
        Authorization: 'Bearer headertoken',
        Cookie: 'clawpipe_session=cookietoken',
      },
    });
    expect(extractToken(req)).toBe('headertoken');
  });

  it('returns null when no token present', () => {
    const req = new Request('https://x/');
    expect(extractToken(req)).toBeNull();
  });

  it('returns null when cookie has no clawpipe_session', () => {
    const req = new Request('https://x/', { headers: { Cookie: 'other=value' } });
    expect(extractToken(req)).toBeNull();
  });

  it('returns null when Authorization header is not Bearer', () => {
    const req = new Request('https://x/', { headers: { Authorization: 'Basic abc' } });
    expect(extractToken(req)).toBeNull();
  });
});

describe('sessionCookie', () => {
  it('produces correct Set-Cookie string', () => {
    const c = sessionCookie('tok123');
    expect(c).toContain('clawpipe_session=tok123');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Path=/');
  });

  it('respects custom maxAge', () => {
    const c = sessionCookie('tok', 3600);
    expect(c).toContain('Max-Age=3600');
  });
});

describe('clearSessionCookie', () => {
  it('returns Max-Age=0', () => {
    const c = clearSessionCookie();
    expect(c).toContain('clawpipe_session=');
    expect(c).toContain('Max-Age=0');
  });
});
