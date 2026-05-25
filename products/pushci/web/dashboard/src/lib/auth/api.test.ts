import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeCode, getProviderConfig, verifyToken } from './api';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  // Force network path: no env client id for tests
  vi.stubEnv('VITE_GITHUB_CLIENT_ID', '');
  vi.stubEnv('VITE_GITLAB_CLIENT_ID', '');
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
  vi.stubEnv('VITE_LINKEDIN_CLIENT_ID', '');
  vi.stubEnv('VITE_FACEBOOK_CLIENT_ID', '');
  vi.stubEnv('VITE_BITBUCKET_CLIENT_ID', '');
  vi.stubEnv('VITE_MICROSOFT_CLIENT_ID', '');
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('getProviderConfig', () => {
  it('returns the client id and baseUrl from the API', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ clientId: 'gh-id', baseUrl: 'https://gh.example' }),
    );
    expect(await getProviderConfig('github')).toEqual({
      clientId: 'gh-id',
      baseUrl: 'https://gh.example',
    });
  });

  it('returns empty client id when API returns 4xx/5xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('no', { status: 500 }));
    expect(await getProviderConfig('github')).toEqual({ clientId: '' });
  });

  it('returns empty client id when network throws', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network'); });
    expect(await getProviderConfig('github')).toEqual({ clientId: '' });
  });
});

describe('exchangeCode', () => {
  it('returns token and user on success', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ token: 't', user: { login: 'a', avatar_url: '', name: 'A' } }),
    );
    const out = await exchangeCode('github', 'code-abc');
    expect(out.token).toBe('t');
    expect(out.user.login).toBe('a');
  });

  it('throws with server error message on 4xx', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: 'invalid code' }, 400),
    );
    await expect(exchangeCode('github', 'x')).rejects.toThrow(/invalid code/);
  });

  it('throws when token missing from 200 response', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ user: { login: 'a', avatar_url: '', name: 'A' } }),
    );
    await expect(exchangeCode('github', 'x')).rejects.toThrow(/incomplete response/);
  });

  it('throws when user missing from 200 response', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ token: 't' }),
    );
    await expect(exchangeCode('github', 'x')).rejects.toThrow(/incomplete response/);
  });

  it('throws on non-json server response', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 502 }));
    await expect(exchangeCode('github', 'x')).rejects.toThrow();
  });
});

describe('verifyToken', () => {
  it('returns true when /api/user/me is 200', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    expect(await verifyToken('t')).toBe(true);
  });
  it('returns false on 401', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 401 }));
    expect(await verifyToken('t')).toBe(false);
  });
});
