/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
import { routeAuth } from './router';
import type { Env } from '../types';

vi.mock('./routes', () => ({
  handleRegister: vi.fn().mockResolvedValue(new Response('register', { status: 200 })),
  handleLogin: vi.fn().mockResolvedValue(new Response('login', { status: 200 })),
  handleLogout: vi.fn().mockResolvedValue(new Response('logout', { status: 200 })),
  handleMe: vi.fn().mockResolvedValue(new Response('me', { status: 200 })),
}));
vi.mock('./oauth', () => ({
  handleGoogleRedirect: vi.fn().mockResolvedValue(new Response('g-redir', { status: 302 })),
  handleGoogleCallback: vi.fn().mockResolvedValue(new Response('g-cb', { status: 200 })),
  handleGithubRedirect: vi.fn().mockResolvedValue(new Response('gh-redir', { status: 302 })),
  handleGithubCallback: vi.fn().mockResolvedValue(new Response('gh-cb', { status: 200 })),
}));
vi.mock('./oidc', () => ({
  handleOidcRedirect: vi.fn().mockResolvedValue(new Response('oidc-redir', { status: 302 })),
  handleOidcCallback: vi.fn().mockResolvedValue(new Response('oidc-cb', { status: 200 })),
}));
vi.mock('./api-keys', () => ({
  handleCreateProject: vi.fn().mockResolvedValue(new Response('proj-create', { status: 201 })),
  handleListProjects: vi.fn().mockResolvedValue(new Response('proj-list', { status: 200 })),
  handleCreateKey: vi.fn().mockResolvedValue(new Response('key-create', { status: 201 })),
  handleListKeys: vi.fn().mockResolvedValue(new Response('key-list', { status: 200 })),
  handleRotateKey: vi.fn().mockResolvedValue(new Response('key-rotate', { status: 200 })),
  handleRevokeKey: vi.fn().mockResolvedValue(new Response('key-revoke', { status: 200 })),
}));

const env = {
  GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 's',
  GITHUB_CLIENT_ID: 'gh', GITHUB_CLIENT_SECRET: 'ghs',
  OIDC_ISSUER: 'https://oidc/', OIDC_CLIENT_ID: 'oc', OIDC_CLIENT_SECRET: 'ocs',
} as unknown as Env;

function req(path: string, method: string = 'GET'): Request {
  return new Request(`https://api.clawpipe.ai${path}`, { method });
}

describe('routeAuth', () => {
  it.each([
    ['/auth/register', 'POST', 'register'],
    ['/auth/login', 'POST', 'login'],
    ['/auth/logout', 'POST', 'logout'],
    ['/auth/me', 'GET', 'me'],
    ['/auth/google', 'GET', 'g-redir'],
    ['/auth/google/callback', 'GET', 'g-cb'],
    ['/auth/github', 'GET', 'gh-redir'],
    ['/auth/github/callback', 'GET', 'gh-cb'],
    ['/auth/oidc', 'GET', 'oidc-redir'],
    ['/auth/oidc/callback', 'GET', 'oidc-cb'],
    ['/v1/projects', 'POST', 'proj-create'],
    ['/v1/projects', 'GET', 'proj-list'],
  ])('%s %s -> matches', async (path, method, expectedBody) => {
    const r = await routeAuth(req(path, method), env, path, method);
    expect(await r!.text()).toBe(expectedBody);
  });

  it('GET /auth/providers reflects env presence', async () => {
    const r = await routeAuth(req('/auth/providers'), env, '/auth/providers', 'GET');
    const body = await r!.json() as { google: boolean; github: boolean; oidc: boolean };
    expect(body).toEqual({ google: true, github: true, oidc: true });
  });

  it('GET /auth/providers returns false when env missing', async () => {
    const r = await routeAuth(req('/auth/providers'), {} as Env, '/auth/providers', 'GET');
    const body = await r!.json() as { google: boolean; github: boolean; oidc: boolean };
    expect(body).toEqual({ google: false, github: false, oidc: false });
  });

  it.each([
    ['/v1/projects/p1/keys', 'POST', 'key-create'],
    ['/v1/projects/p1/keys', 'GET', 'key-list'],
    ['/v1/projects/p1/keys', 'DELETE', 'key-revoke'],
    ['/v1/projects/p1/keys/rotate', 'POST', 'key-rotate'],
  ])('%s %s -> key route %s', async (path, method, body) => {
    const r = await routeAuth(req(path, method), env, path, method);
    expect(await r!.text()).toBe(body);
  });

  it('returns null for unmatched paths', async () => {
    expect(await routeAuth(req('/v1/prompt', 'POST'), env, '/v1/prompt', 'POST')).toBeNull();
  });

  it('returns null for unsupported method on /auth/register', async () => {
    expect(await routeAuth(req('/auth/register', 'GET'), env, '/auth/register', 'GET')).toBeNull();
  });
});
