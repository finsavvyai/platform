/** @vitest-environment node */
/** Coverage for handleOidcCallback branches not exercised by oidc.test.ts. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleOidcRedirect, handleOidcCallback } from './oidc';
import type { Env } from '../types';

vi.mock('./jwks', () => ({
  verifyIdToken: vi.fn(),
}));
vi.mock('./jwt', () => ({
  createToken: vi.fn().mockResolvedValue('jwt-token'),
  sessionCookie: (jwt: string) => `session=${jwt}; HttpOnly; Path=/`,
}));

import { verifyIdToken } from './jwks';

const ORIGINAL_FETCH = globalThis.fetch;

interface FetchPlan {
  discovery?: { ok: boolean; doc: object };
  token?: { ok: boolean; json: object };
  userinfo?: { ok: boolean; json: object };
}

function mockFetch(plan: FetchPlan) {
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes('.well-known/openid-configuration')) {
      return new Response(JSON.stringify(plan.discovery?.doc ?? {}), { status: plan.discovery?.ok ? 200 : 502 });
    }
    if (u.includes('/token')) {
      return new Response(JSON.stringify(plan.token?.json ?? {}), { status: plan.token?.ok ? 200 : 502 });
    }
    if (u.includes('userinfo')) {
      return new Response(JSON.stringify(plan.userinfo?.json ?? {}), { status: plan.userinfo?.ok ? 200 : 502 });
    }
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
}

interface DBState {
  oauthRow?: { user_id: string } | null;
  userById?: { id: string; email: string; name: string } | null;
  userByEmail?: { id: string; email: string; name: string } | null;
}
function makeDB(state: DBState) {
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        first: async <T>(): Promise<T | null> => {
          if (sql.includes('FROM oauth_accounts')) return (state.oauthRow ?? null) as unknown as T;
          if (sql.includes('FROM users WHERE id = ?')) return (state.userById ?? null) as unknown as T;
          if (sql.includes('FROM users WHERE email = ?')) return (state.userByEmail ?? null) as unknown as T;
          return null;
        },
        run: async () => ({ success: true }),
      }),
    }),
    batch: async () => [],
  };
}

const baseEnv = {
  AUTH_SECRET: 's', OIDC_ISSUER: 'https://idp.test/',
  OIDC_CLIENT_ID: 'cid', OIDC_CLIENT_SECRET: 'csec',
} as Env;

const mkEnv = (state: DBState = {}, extra: Partial<Env> = {}): Env => ({
  ...baseEnv, DB: makeDB(state) as unknown as D1Database, ...extra,
} as Env);

const DOC = {
  issuer: 'https://idp.test/', authorization_endpoint: 'https://idp.test/auth',
  token_endpoint: 'https://idp.test/token', jwks_uri: 'https://idp.test/jwks',
  userinfo_endpoint: 'https://idp.test/userinfo',
};

const COOKIE_VAL = btoa(JSON.stringify({ state: 's-1', nonce: 'n-1' }));

function callbackReq(query: string, cookie?: string): Request {
  const url = `https://api.test/auth/oidc/callback${query}`;
  const headers: Record<string, string> = {};
  if (cookie) headers['cookie'] = `clawpipe_oidc_state=${cookie}`;
  return new Request(url, { headers });
}

beforeEach(() => { vi.mocked(verifyIdToken).mockReset(); });
afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

describe('handleOidcRedirect', () => {
  it('503 when env missing', async () => {
    const r = await handleOidcRedirect(new Request('https://api.test/auth/oidc'), {} as Env);
    expect(r.status).toBe(503);
  });
  it('302 + Set-Cookie with state and nonce stash', async () => {
    mockFetch({ discovery: { ok: true, doc: DOC } });
    const r = await handleOidcRedirect(new Request('https://api.test/auth/oidc'), mkEnv());
    expect(r.status).toBe(302);
    expect(r.headers.get('Set-Cookie')).toContain('clawpipe_oidc_state=');
    expect(r.headers.get('Location')).toContain('idp.test/auth');
  });
});

describe('handleOidcCallback', () => {
  it('503 when env missing', async () => {
    const r = await handleOidcCallback(callbackReq('?code=x'), { OIDC_ISSUER: 'x' } as Env);
    expect(r.status).toBe(503);
  });

  it('400 when code missing', async () => {
    const r = await handleOidcCallback(callbackReq(''), mkEnv());
    expect(r.status).toBe(400);
  });

  it('400 when state cookie missing', async () => {
    const r = await handleOidcCallback(callbackReq('?code=abc&state=s-1'), mkEnv());
    expect(r.status).toBe(400);
  });

  it('400 when state cookie malformed (not base64)', async () => {
    const r = await handleOidcCallback(callbackReq('?code=abc&state=s-1', 'not-base64!!'), mkEnv());
    expect(r.status).toBe(400);
  });

  it('400 when state mismatch', async () => {
    const cookie = btoa(JSON.stringify({ state: 'OTHER', nonce: 'n-1' }));
    mockFetch({ discovery: { ok: true, doc: DOC } });
    const r = await handleOidcCallback(callbackReq('?code=abc&state=s-1', cookie), mkEnv());
    expect(r.status).toBe(400);
  });

  it('502 when token exchange fails', async () => {
    mockFetch({ discovery: { ok: true, doc: DOC }, token: { ok: false, json: {} } });
    const r = await handleOidcCallback(callbackReq('?code=abc&state=s-1', COOKIE_VAL), mkEnv());
    expect(r.status).toBe(502);
  });

  it('401 when id_token signature invalid', async () => {
    mockFetch({ discovery: { ok: true, doc: DOC }, token: { ok: true, json: { id_token: 'bad' } } });
    vi.mocked(verifyIdToken).mockResolvedValue(null);
    const r = await handleOidcCallback(callbackReq('?code=abc&state=s-1', COOKIE_VAL), mkEnv());
    expect(r.status).toBe(401);
  });

  it('400 when nonce mismatch', async () => {
    mockFetch({ discovery: { ok: true, doc: DOC }, token: { ok: true, json: { id_token: 'good' } } });
    vi.mocked(verifyIdToken).mockResolvedValue({ sub: 'u', email: 'a@b.test', nonce: 'WRONG' });
    const r = await handleOidcCallback(callbackReq('?code=abc&state=s-1', COOKIE_VAL), mkEnv());
    expect(r.status).toBe(400);
  });

  it('400 when no email in claims and no userinfo', async () => {
    mockFetch({ discovery: { ok: true, doc: { ...DOC, userinfo_endpoint: undefined } }, token: { ok: true, json: { id_token: 'good' } } });
    vi.mocked(verifyIdToken).mockResolvedValue({ sub: 'u', nonce: 'n-1' });
    const r = await handleOidcCallback(callbackReq('?code=abc&state=s-1', COOKIE_VAL), mkEnv());
    expect(r.status).toBe(400);
  });

  it('302 happy path with id_token + verified claims', async () => {
    mockFetch({ discovery: { ok: true, doc: DOC }, token: { ok: true, json: { id_token: 'good' } } });
    vi.mocked(verifyIdToken).mockResolvedValue({
      sub: 'oidc-user-1', email: 'enterprise@b.test', name: 'Bob', nonce: 'n-1',
    });
    const env = mkEnv({ oauthRow: { user_id: 'u1' }, userById: { id: 'u1', email: 'enterprise@b.test', name: 'Bob' } });
    const r = await handleOidcCallback(callbackReq('?code=abc&state=s-1', COOKIE_VAL), env);
    expect(r.status).toBe(302);
    expect(r.headers.get('Location')).toContain('app.test/');
  });

  it('302 happy path with userinfo fallback when claims missing email', async () => {
    mockFetch({
      discovery: { ok: true, doc: DOC },
      token: { ok: true, json: { id_token: 'good', access_token: 'a-tok' } },
      userinfo: { ok: true, json: { sub: 'u', email: 'fallback@b.test', name: 'F' } },
    });
    vi.mocked(verifyIdToken).mockResolvedValue({ sub: 'u', nonce: 'n-1' });
    const env = mkEnv({
      oauthRow: { user_id: 'u1' },
      userById: { id: 'u1', email: 'fallback@b.test', name: 'F' },
    });
    const r = await handleOidcCallback(callbackReq('?code=abc&state=s-1', COOKIE_VAL), env);
    expect(r.status).toBe(302);
  });
});
