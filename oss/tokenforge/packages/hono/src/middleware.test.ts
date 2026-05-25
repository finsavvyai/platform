import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { tokenforge } from './middleware.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const stubRegisterResponse = {
  session_id: 'tf_sess_x',
  short_cookie: { name: 'tf_bound', value: 'short', max_age: 300, attributes: 'Secure;HttpOnly;SameSite=Lax;Path=/' },
  long_cookie: { name: 'tf_session', value: 'long', max_age: 2_592_000, attributes: 'Secure;HttpOnly;SameSite=Lax;Path=/' },
  refresh_url: 'https://api.test/v1/sessions/refresh',
  challenge: 'first-nonce',
};

function buildApp(opts: Parameters<typeof tokenforge>[0]) {
  const app = new Hono();
  app.use('*', tokenforge(opts));
  app.get('/dashboard', (c) => c.json({ ok: true }));
  return app;
}

describe('tokenforge middleware: register passthrough', () => {
  it('returns 401 when onLogin returns null', async () => {
    const app = buildApp({
      appId: 'app_a',
      apiKey: 'tfk_live_app_a.x',
      onLogin: async () => null,
      fetchImpl: (async () => jsonResponse(stubRegisterResponse)) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/__tokenforge/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key_jwk: { kty: 'EC' }, binding_class: 'webcrypto' }),
    });
    expect(r.status).toBe(401);
  });

  it('returns 400 when pubkey is missing', async () => {
    const app = buildApp({
      appId: 'app_a',
      apiKey: 'k',
      onLogin: async () => ({ subject: 'u' }),
      fetchImpl: (async () => jsonResponse(stubRegisterResponse)) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/__tokenforge/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(400);
  });

  it('forwards to TokenForge, sets cookies, swaps refresh_url', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(stubRegisterResponse)) as unknown as typeof globalThis.fetch;
    const app = buildApp({
      appId: 'app_a',
      apiKey: 'tfk_live_app_a.x',
      onLogin: async () => ({ subject: 'user_42', metadata: { plan: 'pro' } }),
      fetchImpl: fetchSpy,
    });
    const r = await app.request('http://customer.test/__tokenforge/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key_jwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }, binding_class: 'webcrypto' }),
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { session_id: string; refresh_url: string; challenge: string };
    expect(j.session_id).toBe('tf_sess_x');
    expect(j.refresh_url).toBe('http://customer.test/__tokenforge/refresh');
    const cookies = r.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('tf_bound=short'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('tf_session=long'))).toBe(true);
  });

  it('returns 502 when TokenForge upstream fails', async () => {
    const app = buildApp({
      appId: 'a',
      apiKey: 'k',
      onLogin: async () => ({ subject: 'u' }),
      fetchImpl: (async () => new Response('', { status: 500 })) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/__tokenforge/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key_jwk: { kty: 'EC' }, binding_class: 'webcrypto' }),
    });
    expect(r.status).toBe(502);
  });
});

describe('tokenforge middleware: refresh passthrough', () => {
  const refreshOk = {
    short_cookie: { name: 'tf_bound', value: 'rotated', max_age: 300, attributes: 'Secure;HttpOnly' },
    challenge: 'next-nonce',
    action: 'allow' as const,
    signals: [] as string[],
  };

  it('rejects missing DPoP', async () => {
    const app = buildApp({
      appId: 'a', apiKey: 'k',
      onLogin: async () => null,
      fetchImpl: (async () => jsonResponse(refreshOk)) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/__tokenforge/refresh', { method: 'POST' });
    expect(r.status).toBe(401);
  });

  it('forwards DPoP, returns rotated cookie + next challenge', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(refreshOk)) as unknown as typeof globalThis.fetch;
    const app = buildApp({
      appId: 'a', apiKey: 'k',
      onLogin: async () => null,
      fetchImpl: fetchSpy,
    });
    const r = await app.request('/__tokenforge/refresh', {
      method: 'POST',
      headers: { DPoP: 'aaa.bbb.ccc' },
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { challenge: string; action: string };
    expect(j.action).toBe('allow');
    expect(j.challenge).toBe('next-nonce');
    expect(r.headers.getSetCookie().some((c) => c.startsWith('tf_bound=rotated'))).toBe(true);
  });

  it('invokes onStepUp when action=step_up', async () => {
    const onStepUp = vi.fn(async (c, signals: string[]) =>
      c.json({ stepUp: true, signals }, 401),
    );
    const stepUpResponse = { ...refreshOk, action: 'step_up' as const, signals: ['geo_drift'] };
    const app = buildApp({
      appId: 'a', apiKey: 'k',
      onLogin: async () => null,
      onStepUp,
      fetchImpl: (async () => jsonResponse(stepUpResponse)) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/__tokenforge/refresh', {
      method: 'POST',
      headers: { DPoP: 'x.y.z' },
    });
    expect(r.status).toBe(401);
    expect(onStepUp).toHaveBeenCalled();
    const j = (await r.json()) as { signals: string[] };
    expect(j.signals).toEqual(['geo_drift']);
  });

  it('default step_up handler returns 401 with signals', async () => {
    const stepUpResponse = { ...refreshOk, action: 'step_up' as const, signals: ['vpn'] };
    const app = buildApp({
      appId: 'a', apiKey: 'k',
      onLogin: async () => null,
      fetchImpl: (async () => jsonResponse(stepUpResponse)) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/__tokenforge/refresh', {
      method: 'POST',
      headers: { DPoP: 'x.y.z' },
    });
    expect(r.status).toBe(401);
    const j = (await r.json()) as { signals: string[] };
    expect(j.signals).toEqual(['vpn']);
  });

  it('invokes onRevoked when action=block', async () => {
    const onRevoked = vi.fn(async (c) => c.json({ revoked: true }, 403));
    const blockResponse = { ...refreshOk, action: 'block' as const };
    const app = buildApp({
      appId: 'a', apiKey: 'k',
      onLogin: async () => null,
      onRevoked,
      fetchImpl: (async () => jsonResponse(blockResponse)) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/__tokenforge/refresh', {
      method: 'POST',
      headers: { DPoP: 'x.y.z' },
    });
    expect(r.status).toBe(403);
    expect(onRevoked).toHaveBeenCalled();
  });

  it('default block handler returns 403', async () => {
    const blockResponse = { ...refreshOk, action: 'block' as const };
    const app = buildApp({
      appId: 'a', apiKey: 'k',
      onLogin: async () => null,
      fetchImpl: (async () => jsonResponse(blockResponse)) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/__tokenforge/refresh', {
      method: 'POST',
      headers: { DPoP: 'x.y.z' },
    });
    expect(r.status).toBe(403);
  });

  it('forwards upstream error status on refresh failure', async () => {
    const app = buildApp({
      appId: 'a', apiKey: 'k',
      onLogin: async () => null,
      fetchImpl: (async () => new Response('', { status: 401 })) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/__tokenforge/refresh', {
      method: 'POST',
      headers: { DPoP: 'x.y.z' },
    });
    expect(r.status).toBe(401);
  });
});

describe('tokenforge middleware: passthrough', () => {
  it('does not intercept other paths and exposes the client on c.set', async () => {
    const app = buildApp({
      appId: 'a', apiKey: 'k',
      onLogin: async () => null,
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/dashboard');
    expect(r.status).toBe(200);
  });
});
