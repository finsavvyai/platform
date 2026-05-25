import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { requireFreshSig, shouldSkip, isSensitiveOp } from './middleware.js';

function appWithGate(min: number, tf?: { trustScore: number }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (tf) c.set('tf', tf);
    await next();
  });
  app.use('/admin/*', requireFreshSig({ minTrustScore: min }));
  app.get('/admin/secret', (c) => c.text('ok'));
  app.get('/public', (c) => c.text('public'));
  return app;
}

describe('requireFreshSig', () => {
  it('passes through when trustScore meets the minimum', async () => {
    const res = await appWithGate(90, { trustScore: 92 }).request('/admin/secret');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('rejects when trustScore is below the minimum', async () => {
    const res = await appWithGate(90, { trustScore: 50 }).request('/admin/secret');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'elevated_trust_required',
      action: 'step_up_required',
      trustScore: 50,
    });
  });

  it('rejects when tf context is missing', async () => {
    const res = await appWithGate(90).request('/admin/secret');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.trustScore).toBe(0);
  });

  it('does not gate routes outside its mount point', async () => {
    const res = await appWithGate(90, { trustScore: 10 }).request('/public');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('public');
  });

  it('defaults the minimum to 90 when no options are provided', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('tf', { trustScore: 89 });
      await next();
    });
    app.use('/admin/*', requireFreshSig());
    app.get('/admin/x', (c) => c.text('ok'));

    const res = await app.request('/admin/x');
    expect(res.status).toBe(403);
  });

  it('accepts trustScore exactly at the threshold', async () => {
    const res = await appWithGate(85, { trustScore: 85 }).request('/admin/secret');
    expect(res.status).toBe(200);
  });
});

describe('shouldSkip', () => {
  it('returns false when skipPaths is undefined', () => {
    expect(shouldSkip('/anything')).toBe(false);
  });

  it('matches exact paths from the skip list', () => {
    expect(shouldSkip('/health', ['/health', '/metrics'])).toBe(true);
    expect(shouldSkip('/metrics', ['/health', '/metrics'])).toBe(true);
  });

  it('matches glob-prefix patterns ending in *', () => {
    expect(shouldSkip('/public/foo', ['/public/*'])).toBe(true);
    expect(shouldSkip('/public/foo/bar/baz', ['/public/*'])).toBe(true);
  });

  it('returns false for paths not in skipPaths', () => {
    expect(shouldSkip('/private', ['/public/*', '/health'])).toBe(false);
  });

  it('exact entry does not glob-match (without trailing *)', () => {
    // '/admin' is exact-only, NOT a prefix for /admin/users
    expect(shouldSkip('/admin/users', ['/admin'])).toBe(false);
  });
});

describe('isSensitiveOp', () => {
  it('returns false when sensitiveOps is undefined', () => {
    expect(isSensitiveOp('/checkout', 'POST')).toBe(false);
  });

  it('matches "METHOD path" exact strings', () => {
    expect(isSensitiveOp('/checkout', 'POST', ['POST /checkout'])).toBe(true);
    expect(isSensitiveOp('/checkout', 'GET', ['POST /checkout'])).toBe(false);
  });

  it('glob `*` in path matches a single segment but NOT slash-traversal', () => {
    const ops = ['POST /admin/*'];
    expect(isSensitiveOp('/admin/billing', 'POST', ops)).toBe(true);
    // The internal regex uses [^/]+ so multi-segment paths do not match
    expect(isSensitiveOp('/admin/billing/refund', 'POST', ops)).toBe(false);
  });

  it('method mismatch returns false even when path glob matches', () => {
    expect(isSensitiveOp('/admin/users', 'GET', ['POST /admin/*'])).toBe(false);
  });

  it('returns false when sensitiveOps contains malformed entry (only method, no path)', () => {
    expect(isSensitiveOp('/x', 'POST', ['POST'])).toBe(false);
  });
});
