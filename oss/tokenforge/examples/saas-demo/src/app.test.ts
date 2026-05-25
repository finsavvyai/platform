import { describe, it, expect, beforeEach } from 'vitest';
import { buildDemoApp, _testInternals } from './app.js';

const tfRegisterStub = {
  session_id: 'tf_sess_demo',
  short_cookie: { name: 'tf_bound', value: 'sv', max_age: 300, attributes: 'Secure;HttpOnly;SameSite=Lax;Path=/' },
  long_cookie: { name: 'tf_session', value: 'lv', max_age: 2_592_000, attributes: 'Secure;HttpOnly;SameSite=Lax;Path=/' },
  refresh_url: 'https://api.test/v1/sessions/refresh',
  challenge: 'first',
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

beforeEach(() => {
  _testInternals.sessions.clear();
});

describe('saas-demo end-to-end', () => {
  it('blocks /dashboard before login', async () => {
    const app = buildDemoApp({
      appId: 'app_demo',
      apiKey: 'tfk_live_app_demo.x',
      fetchImpl: (async () => jsonResponse(tfRegisterStub)) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/dashboard');
    expect(r.status).toBe(401);
  });

  it('login → register → dashboard', async () => {
    const app = buildDemoApp({
      appId: 'app_demo',
      apiKey: 'tfk_live_app_demo.x',
      fetchImpl: (async () => jsonResponse(tfRegisterStub)) as unknown as typeof globalThis.fetch,
    });

    const login = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    expect(login.status).toBe(200);
    const demoSession = login.headers.getSetCookie().find((c) => c.startsWith('demo_session='));
    expect(demoSession).toBeTruthy();
    const demoCookie = demoSession!.split(';')[0]!;

    const reg = await app.request('http://customer.test/__tokenforge/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: demoCookie },
      body: JSON.stringify({ public_key_jwk: { kty: 'EC' }, binding_class: 'webcrypto' }),
    });
    expect(reg.status).toBe(200);
    const tfBound = reg.headers.getSetCookie().find((c) => c.startsWith('tf_bound='));
    expect(tfBound).toBeTruthy();

    const dash = await app.request('/dashboard', {
      headers: { Cookie: `${demoCookie}; tf_bound=sv` },
    });
    expect(dash.status).toBe(200);
    const j = (await dash.json()) as { welcome: string };
    expect(j.welcome).toBe('alice@example.com');
  });

  it('logout clears the demo session', async () => {
    const app = buildDemoApp({
      appId: 'a', apiKey: 'k',
      fetchImpl: (async () => jsonResponse(tfRegisterStub)) as unknown as typeof globalThis.fetch,
    });
    const login = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'b@x' }),
    });
    const demoCookie = login.headers.getSetCookie().find((c) => c.startsWith('demo_session='))!.split(';')[0]!;

    const logout = await app.request('/logout', {
      method: 'POST',
      headers: { Cookie: demoCookie },
    });
    expect(logout.status).toBe(200);

    const after = await app.request('/whoami', { headers: { Cookie: demoCookie } });
    const j = (await after.json()) as { user: unknown; bound: boolean };
    expect(j.user).toBeNull();
  });

  it('register without prior login → 401', async () => {
    const app = buildDemoApp({
      appId: 'a', apiKey: 'k',
      fetchImpl: (async () => jsonResponse(tfRegisterStub)) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/__tokenforge/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key_jwk: { kty: 'EC' }, binding_class: 'webcrypto' }),
    });
    expect(r.status).toBe(401);
  });

  it('login requires email', async () => {
    const app = buildDemoApp({
      appId: 'a', apiKey: 'k',
      fetchImpl: (async () => jsonResponse(tfRegisterStub)) as unknown as typeof globalThis.fetch,
    });
    const r = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(400);
  });
});
