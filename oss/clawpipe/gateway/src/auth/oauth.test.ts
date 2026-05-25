/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleGoogleRedirect, handleGoogleCallback,
  handleGithubRedirect, handleGithubCallback,
} from './oauth';
import type { Env } from '../types';

vi.mock('./jwt', () => ({
  createToken: vi.fn().mockResolvedValue('jwt-token'),
  sessionCookie: (jwt: string) => `session=${jwt}; HttpOnly; Path=/`,
}));

const ORIGINAL_FETCH = globalThis.fetch;

interface MockFetchPlan {
  token?: { ok: boolean; json: object };
  profile?: { ok: boolean; json: object };
  emails?: { ok: boolean; json: object };
}

function mockFetch(plan: MockFetchPlan) {
  let i = 0;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes('googleapis.com/token') || u.includes('github.com/login/oauth/access_token')) {
      return new Response(JSON.stringify(plan.token?.json ?? {}), { status: plan.token?.ok ? 200 : 502 });
    }
    if (u.includes('userinfo') || u.includes('api.github.com/user') && !u.includes('emails')) {
      return new Response(JSON.stringify(plan.profile?.json ?? {}), { status: 200 });
    }
    if (u.includes('emails')) {
      return new Response(JSON.stringify(plan.emails?.json ?? []), { status: 200 });
    }
    i++;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
}

interface DBState {
  oauthRow?: { user_id: string } | null;
  userById?: { id: string; email: string; name: string } | null;
  userByEmail?: { id: string; email: string; name: string } | null;
  inserts: Array<{ binds: unknown[] }>;
  batched?: number;
}

function makeDB(state: DBState) {
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        first: async <T>(): Promise<T | null> => {
          if (sql.includes('FROM oauth_accounts WHERE provider')) return (state.oauthRow ?? null) as unknown as T;
          if (sql.includes('FROM users WHERE id = ?')) return (state.userById ?? null) as unknown as T;
          if (sql.includes('FROM users WHERE email = ?')) return (state.userByEmail ?? null) as unknown as T;
          return null;
        },
        run: async () => {
          if (sql.startsWith('INSERT')) state.inserts.push({ binds });
          return { success: true };
        },
      }),
    }),
    batch: async (arr: unknown[]) => { state.batched = arr.length; return []; },
  };
}

const mkEnv = (state: Partial<DBState> = {}, extra: Partial<Env> = {}): Env => ({
  DB: makeDB({ inserts: [], ...state }) as unknown as D1Database,
  AUTH_SECRET: 'auth-secret',
  GOOGLE_CLIENT_ID: 'g-id',
  GOOGLE_CLIENT_SECRET: 'g-sec',
  GITHUB_CLIENT_ID: 'gh-id',
  GITHUB_CLIENT_SECRET: 'gh-sec',
  ...extra,
} as Env);

beforeEach(() => { /* no-op */ });
afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

describe('handleGoogleRedirect', () => {
  it('503 when GOOGLE_CLIENT_ID missing', () => {
    const r = handleGoogleRedirect({ } as Env, 'https://api.test');
    expect(r.status).toBe(503);
  });
  it('302 redirect with all params', () => {
    const r = handleGoogleRedirect(mkEnv(), 'https://api.test');
    expect(r.status).toBe(302);
    const loc = r.headers.get('Location')!;
    expect(loc).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(loc).toContain('client_id=g-id');
    expect(loc).toContain('redirect_uri=https%3A%2F%2Fapi.test%2Fauth%2Fgoogle%2Fcallback');
  });
});

describe('handleGoogleCallback', () => {
  it('503 when AUTH_SECRET missing', async () => {
    const r = await handleGoogleCallback(
      new Request('https://api.test/auth/google/callback?code=abc'),
      { GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y' } as Env,
    );
    expect(r.status).toBe(503);
  });
  it('400 when code missing', async () => {
    const r = await handleGoogleCallback(
      new Request('https://api.test/auth/google/callback'),
      mkEnv(),
    );
    expect(r.status).toBe(400);
  });
  it('502 when token exchange fails', async () => {
    mockFetch({ token: { ok: false, json: {} } });
    const r = await handleGoogleCallback(
      new Request('https://api.test/auth/google/callback?code=abc'),
      mkEnv(),
    );
    expect(r.status).toBe(502);
  });
  it('400 when profile has no email', async () => {
    mockFetch({
      token: { ok: true, json: { access_token: 't' } },
      profile: { ok: true, json: { id: '1', name: 'A', email: '', picture: '' } },
    });
    const r = await handleGoogleCallback(
      new Request('https://api.test/auth/google/callback?code=abc'),
      mkEnv(),
    );
    expect(r.status).toBe(400);
  });
  it('302 + session cookie on success — reuses existing user', async () => {
    mockFetch({
      token: { ok: true, json: { access_token: 't' } },
      profile: { ok: true, json: { id: 'gid', name: 'A', email: 'a@b.test', picture: '' } },
    });
    const env = mkEnv({
      oauthRow: { user_id: 'u1' },
      userById: { id: 'u1', email: 'a@b.test', name: 'A' },
    });
    const r = await handleGoogleCallback(
      new Request('https://api.test/auth/google/callback?code=abc'),
      env,
    );
    expect(r.status).toBe(302);
    expect(r.headers.get('Set-Cookie')).toContain('session=jwt-token');
    expect(r.headers.get('Location')).toContain('app.test/dashboard');
  });
  it('302 + creates new user when neither oauth row nor email match', async () => {
    mockFetch({
      token: { ok: true, json: { access_token: 't' } },
      profile: { ok: true, json: { id: 'gid', name: 'New', email: 'new@b.test', picture: 'p' } },
    });
    const state: DBState = { inserts: [] };
    const env = { DB: makeDB(state) as unknown as D1Database, AUTH_SECRET: 's', GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 's' } as Env;
    const r = await handleGoogleCallback(
      new Request('https://api.test/auth/google/callback?code=abc'),
      env,
    );
    expect(r.status).toBe(302);
    expect(state.batched).toBe(2);
  });
});

describe('handleGithubRedirect', () => {
  it('503 when GITHUB_CLIENT_ID missing', () => {
    const r = handleGithubRedirect({} as Env, 'https://api.test');
    expect(r.status).toBe(503);
  });
  it('302 redirect with scope', () => {
    const r = handleGithubRedirect(mkEnv(), 'https://api.test');
    expect(r.status).toBe(302);
    expect(r.headers.get('Location')).toContain('github.com/login/oauth/authorize');
  });
});

describe('handleGithubCallback', () => {
  it('503 when AUTH_SECRET missing', async () => {
    const r = await handleGithubCallback(
      new Request('https://api.test/auth/github/callback?code=abc'),
      { GITHUB_CLIENT_ID: 'x', GITHUB_CLIENT_SECRET: 'y' } as Env,
    );
    expect(r.status).toBe(503);
  });
  it('400 when code missing', async () => {
    const r = await handleGithubCallback(
      new Request('https://api.test/auth/github/callback'), mkEnv(),
    );
    expect(r.status).toBe(400);
  });
  it('400 when no email anywhere', async () => {
    mockFetch({
      token: { ok: true, json: { access_token: 't' } },
      profile: { ok: true, json: { id: 1, name: 'A', email: '', avatar_url: '' } },
      emails: { ok: true, json: [] },
    });
    const r = await handleGithubCallback(
      new Request('https://api.test/auth/github/callback?code=abc'), mkEnv(),
    );
    expect(r.status).toBe(400);
  });
  it('302 success when profile has primary email', async () => {
    mockFetch({
      token: { ok: true, json: { access_token: 't' } },
      profile: { ok: true, json: { id: 1, name: 'A', email: 'a@b.test', avatar_url: '' } },
    });
    const env = mkEnv({
      oauthRow: { user_id: 'u1' },
      userById: { id: 'u1', email: 'a@b.test', name: 'A' },
    });
    const r = await handleGithubCallback(
      new Request('https://api.test/auth/github/callback?code=abc'), env,
    );
    expect(r.status).toBe(302);
    expect(r.headers.get('Set-Cookie')).toContain('session=jwt-token');
  });
  it('302 success when profile email blank but emails endpoint has primary', async () => {
    mockFetch({
      token: { ok: true, json: { access_token: 't' } },
      profile: { ok: true, json: { id: 1, name: 'A', email: '', avatar_url: '' } },
      emails: { ok: true, json: [{ email: 'fallback@b.test', primary: true }] },
    });
    const env = mkEnv({
      oauthRow: { user_id: 'u1' },
      userById: { id: 'u1', email: 'fallback@b.test', name: 'A' },
    });
    const r = await handleGithubCallback(
      new Request('https://api.test/auth/github/callback?code=abc'), env,
    );
    expect(r.status).toBe(302);
  });
  it('upsert links account when user already exists by email', async () => {
    mockFetch({
      token: { ok: true, json: { access_token: 't' } },
      profile: { ok: true, json: { id: 1, name: 'A', email: 'existing@b.test', avatar_url: '' } },
    });
    const state: DBState = {
      oauthRow: null, userByEmail: { id: 'existing-u', email: 'existing@b.test', name: 'A' }, inserts: [],
    };
    const env = { DB: makeDB(state) as unknown as D1Database, AUTH_SECRET: 's', GITHUB_CLIENT_ID: 'g', GITHUB_CLIENT_SECRET: 's' } as Env;
    const r = await handleGithubCallback(
      new Request('https://api.test/auth/github/callback?code=abc'), env,
    );
    expect(r.status).toBe(302);
    expect(state.inserts).toHaveLength(1); // INSERT INTO oauth_accounts
  });
});
