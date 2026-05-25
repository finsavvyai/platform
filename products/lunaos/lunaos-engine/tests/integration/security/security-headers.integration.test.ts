/**
 * Security Headers Integration Tests
 *
 * Verifies that all required security headers are present
 * on every response from the Hono app.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestContext,
  type TestContext,
} from '../setup';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.dispose();
});

const REQUIRED_HEADERS = [
  'Strict-Transport-Security',
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'X-XSS-Protection',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Embedder-Policy',
  'Cross-Origin-Resource-Policy',
] as const;

describe('Security headers on all responses', () => {
  it('health endpoint includes all security headers', async () => {
    const res = await ctx.makeRequest('/health', { auth: 'none' });

    for (const header of REQUIRED_HEADERS) {
      expect(
        res.headers.get(header),
        `Missing header: ${header}`,
      ).not.toBeNull();
    }
  });

  it('auth endpoint includes all security headers', async () => {
    const res = await ctx.makeRequest('/auth/login', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        email: 'test@lunaos.ai',
        password: 'TestPassword123!',
      }),
    });

    for (const header of REQUIRED_HEADERS) {
      expect(
        res.headers.get(header),
        `Missing header: ${header}`,
      ).not.toBeNull();
    }
  });

  it('404 responses include all security headers', async () => {
    const res = await ctx.makeRequest('/nonexistent-path', {
      auth: 'none',
    });

    expect(res.status).toBe(404);
    for (const header of REQUIRED_HEADERS) {
      expect(
        res.headers.get(header),
        `Missing header on 404: ${header}`,
      ).not.toBeNull();
    }
  });

  it('root endpoint includes all security headers', async () => {
    const res = await ctx.makeRequest('/', { auth: 'none' });

    for (const header of REQUIRED_HEADERS) {
      expect(
        res.headers.get(header),
        `Missing header on root: ${header}`,
      ).not.toBeNull();
    }
  });
});

describe('Security header values', () => {
  it('HSTS includes max-age, includeSubDomains, preload', async () => {
    const res = await ctx.makeRequest('/health', { auth: 'none' });
    const hsts = res.headers.get('Strict-Transport-Security');

    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('X-Content-Type-Options is nosniff', async () => {
    const res = await ctx.makeRequest('/health', { auth: 'none' });
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('X-Frame-Options is DENY', async () => {
    const res = await ctx.makeRequest('/health', { auth: 'none' });
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('CSP includes frame-ancestors none', async () => {
    const res = await ctx.makeRequest('/health', { auth: 'none' });
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('COOP is same-origin', async () => {
    const res = await ctx.makeRequest('/health', { auth: 'none' });
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe(
      'same-origin',
    );
  });

  it('Server header is removed', async () => {
    const res = await ctx.makeRequest('/health', { auth: 'none' });
    expect(res.headers.get('Server')).toBeNull();
    expect(res.headers.get('X-Powered-By')).toBeNull();
  });
});
