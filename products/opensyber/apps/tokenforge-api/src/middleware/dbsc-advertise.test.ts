import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  dbscAdvertise,
  buildAdvertisementHeader,
} from './dbsc-advertise.js';

function appWith(opts?: Parameters<typeof dbscAdvertise>[0]): Hono {
  const app = new Hono();
  app.use('*', dbscAdvertise(opts));
  app.get('/protected', (c) => c.text('ok'));
  app.get('/v1/dbsc/challenge', (c) => {
    c.header('Sec-Session-Registration', '(ES256);path="/v1/dbsc/register";challenge="seeded"');
    return c.json({ data: { challenge: 'seeded' } });
  });
  app.get('/health', (c) => c.text('ok'));
  return app;
}

describe('buildAdvertisementHeader', () => {
  it('emits (ES256);path=... for the default algorithm', () => {
    expect(buildAdvertisementHeader()).toBe('(ES256);path="/v1/dbsc/challenge"');
  });

  it('lists multiple algorithms space-separated', () => {
    expect(buildAdvertisementHeader(['ES256', 'RS256'])).toBe(
      '(ES256 RS256);path="/v1/dbsc/challenge"',
    );
  });

  it('falls back to ES256 when an empty algorithm list is passed', () => {
    expect(buildAdvertisementHeader([])).toBe('(ES256);path="/v1/dbsc/challenge"');
  });

  it('honours a custom challenge path', () => {
    expect(buildAdvertisementHeader(['ES256'], '/auth/dbsc')).toBe(
      '(ES256);path="/auth/dbsc"',
    );
  });
});

describe('dbscAdvertise middleware', () => {
  it('attaches Sec-Session-Registration on responses to unbound clients', async () => {
    const res = await appWith().request('/protected');
    expect(res.headers.get('Sec-Session-Registration')).toBe(
      '(ES256);path="/v1/dbsc/challenge"',
    );
  });

  it('skips the header when the bound cookie is present on the request', async () => {
    const res = await appWith().request('/protected', {
      headers: { cookie: '__Secure-tf-bound=opaque-cookie-value; theme=dark' },
    });
    expect(res.headers.get('Sec-Session-Registration')).toBeNull();
  });

  it('honours a custom cookie name', async () => {
    const res = await appWith({ cookieName: '__Secure-acme-bound' }).request('/protected', {
      headers: { cookie: '__Secure-acme-bound=opaque' },
    });
    expect(res.headers.get('Sec-Session-Registration')).toBeNull();
  });

  it('honours a custom challenge path in the emitted header', async () => {
    const res = await appWith({ challengePath: '/auth/dbsc' }).request('/protected');
    expect(res.headers.get('Sec-Session-Registration')).toBe(
      '(ES256);path="/auth/dbsc"',
    );
  });

  it('does not overwrite a header set by the downstream handler (idempotency)', async () => {
    const res = await appWith().request('/v1/dbsc/challenge');
    expect(res.headers.get('Sec-Session-Registration')).toBe(
      '(ES256);path="/v1/dbsc/register";challenge="seeded"',
    );
  });

  it('respects the paths filter (glob prefix) — only advertises on matched routes', async () => {
    const filtered = appWith({ paths: ['/protected*'] });
    const protectedRes = await filtered.request('/protected');
    expect(protectedRes.headers.get('Sec-Session-Registration')).not.toBeNull();
    const healthRes = await filtered.request('/health');
    expect(healthRes.headers.get('Sec-Session-Registration')).toBeNull();
  });

  it('paths filter accepts exact-match entries too', async () => {
    const filtered = appWith({ paths: ['/protected'] });
    const ok = await filtered.request('/protected');
    expect(ok.headers.get('Sec-Session-Registration')).not.toBeNull();
    const miss = await filtered.request('/health');
    expect(miss.headers.get('Sec-Session-Registration')).toBeNull();
  });

  it('only matches the configured cookie — partial-name confusion does not bypass advertise', async () => {
    // Cookie `__Secure-tf-bound-other=…` must NOT count as the bound cookie
    // because the middleware splits on `;` and matches the trimmed name only.
    const res = await appWith().request('/protected', {
      headers: { cookie: '__Secure-tf-bound-other=fake' },
    });
    expect(res.headers.get('Sec-Session-Registration')).not.toBeNull();
  });

  it('handles requests with no cookie header at all', async () => {
    const res = await appWith().request('/protected');
    expect(res.headers.get('Sec-Session-Registration')).toBe(
      '(ES256);path="/v1/dbsc/challenge"',
    );
  });
});
