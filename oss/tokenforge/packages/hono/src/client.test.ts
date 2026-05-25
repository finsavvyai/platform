import { describe, it, expect, vi } from 'vitest';
import { TokenForgeClient } from './client.js';
import { TokenForgeError } from './types.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('TokenForgeClient.register', () => {
  it('POSTs JSON with X-TokenForge-Key and the appId merged in', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        session_id: 'tf_sess_1',
        short_cookie: { name: 'tf_bound', value: 'a', max_age: 300, attributes: 'Secure;HttpOnly' },
        long_cookie: { name: 'tf_session', value: 'b', max_age: 2592000, attributes: 'Secure;HttpOnly' },
        refresh_url: 'https://api.test/v1/sessions/refresh',
        challenge: 'init',
      });
    }) as unknown as typeof globalThis.fetch;

    const client = new TokenForgeClient({
      apiBase: 'https://api.test',
      appId: 'app_a',
      apiKey: 'tfk_live_app_a.secret',
      fetchImpl,
    });
    const r = await client.register({
      subject: 'user_1',
      public_key_jwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
      binding_class: 'webcrypto',
    });

    expect(r.session_id).toBe('tf_sess_1');
    expect(calls[0]?.url).toBe('https://api.test/v1/sessions/register');
    expect((calls[0]?.init?.headers as Record<string, string>)['X-TokenForge-Key']).toBe(
      'tfk_live_app_a.secret',
    );
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body.app_id).toBe('app_a');
    expect(body.subject).toBe('user_1');
  });

  it('throws TokenForgeError on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 401 })) as unknown as typeof globalThis.fetch;
    const client = new TokenForgeClient({
      apiBase: 'https://api.test', appId: 'a', apiKey: 'k', fetchImpl,
    });
    await expect(
      client.register({
        subject: 's', public_key_jwk: {}, binding_class: 'webcrypto',
      }),
    ).rejects.toBeInstanceOf(TokenForgeError);
  });
});

describe('TokenForgeClient.refresh', () => {
  it('forwards the DPoP header and parses the action field', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        short_cookie: { name: 'tf_bound', value: 'b2', max_age: 300, attributes: 'Secure;HttpOnly' },
        challenge: 'next',
        action: 'allow',
        signals: [],
      }),
    ) as unknown as typeof globalThis.fetch;
    const client = new TokenForgeClient({
      apiBase: 'https://api.test', appId: 'a', apiKey: 'k', fetchImpl,
    });
    const r = await client.refresh('aaa.bbb.ccc');
    expect(r.action).toBe('allow');
    expect(r.short_cookie.value).toBe('b2');
  });

  it('throws on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 403 })) as unknown as typeof globalThis.fetch;
    const client = new TokenForgeClient({
      apiBase: 'https://api.test', appId: 'a', apiKey: 'k', fetchImpl,
    });
    await expect(client.refresh('x.y.z')).rejects.toBeInstanceOf(TokenForgeError);
  });
});

describe('TokenForgeClient.revoke', () => {
  it('calls the revoke endpoint with reason in body', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    const client = new TokenForgeClient({
      apiBase: 'https://api.test', appId: 'a', apiKey: 'k', fetchImpl,
    });
    await client.revoke('tf_sess_x', 'admin');
    expect(calls[0]?.url).toBe('https://api.test/v1/sessions/tf_sess_x/revoke');
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body.reason).toBe('admin');
  });

  it('throws on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof globalThis.fetch;
    const client = new TokenForgeClient({
      apiBase: 'https://api.test', appId: 'a', apiKey: 'k', fetchImpl,
    });
    await expect(client.revoke('s', 'r')).rejects.toBeInstanceOf(TokenForgeError);
  });
});
