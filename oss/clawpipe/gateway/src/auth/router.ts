/** Auth router — dispatches /auth/* and /v1/projects/* requests. */

import type { Env } from '../types';
import { handleRegister, handleLogin, handleLogout, handleMe } from './routes';
import { handleGoogleRedirect, handleGoogleCallback, handleGithubRedirect, handleGithubCallback } from './oauth';
import { handleOidcRedirect, handleOidcCallback } from './oidc';
import { handleCreateProject, handleListProjects } from './api-keys';
import { handleCreateKey, handleListKeys, handleRotateKey, handleRevokeKey } from './api-keys';
import { handlePutProviderKey, handleDeleteProviderKey, handleListProviderKeys } from './provider-keys-routes';

/** Route auth and project management requests. Returns null if path not matched. */
export async function routeAuth(
  request: Request, env: Env, path: string, method: string,
): Promise<Response | null> {
  const origin = new URL(request.url).origin;

  // Auth endpoints (no API key required)
  if (path === '/auth/register' && method === 'POST') return handleRegister(request, env);
  if (path === '/auth/login' && method === 'POST') return handleLogin(request, env);
  if (path === '/auth/logout' && method === 'POST') return handleLogout();
  if (path === '/auth/me' && method === 'GET') return handleMe(request, env);

  // OAuth provider capability discovery — dashboard uses this to show/hide buttons.
  if (path === '/auth/providers' && method === 'GET') {
    return Response.json({
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
      oidc: Boolean(env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET),
    });
  }

  // OAuth redirects
  if (path === '/auth/google' && method === 'GET') return handleGoogleRedirect(env, origin);
  if (path === '/auth/google/callback' && method === 'GET') return handleGoogleCallback(request, env);
  if (path === '/auth/github' && method === 'GET') return handleGithubRedirect(env, origin);
  if (path === '/auth/github/callback' && method === 'GET') return handleGithubCallback(request, env);
  if (path === '/auth/oidc' && method === 'GET') return handleOidcRedirect(request, env);
  if (path === '/auth/oidc/callback' && method === 'GET') return handleOidcCallback(request, env);

  // Project management (JWT auth, not API key)
  if (path === '/v1/projects' && method === 'POST') return handleCreateProject(request, env);
  if (path === '/v1/projects' && method === 'GET') return handleListProjects(request, env);

  // Project key management: /v1/projects/:id/keys
  const keyMatch = path.match(/^\/v1\/projects\/([^/]+)\/keys(\/rotate)?$/);
  if (keyMatch) {
    const projectId = keyMatch[1];
    const isRotate = keyMatch[2] === '/rotate';
    if (method === 'POST' && isRotate) return handleRotateKey(request, env, projectId);
    if (method === 'POST') return handleCreateKey(request, env, projectId);
    if (method === 'GET') return handleListKeys(request, env, projectId);
    if (method === 'DELETE') return handleRevokeKey(request, env, projectId);
  }

  // Per-project provider keys: /v1/projects/:id/provider-keys[/:provider]
  const pkListMatch = path.match(/^\/v1\/projects\/([^/]+)\/provider-keys$/);
  if (pkListMatch && method === 'GET') {
    return handleListProviderKeys(request, env, pkListMatch[1]);
  }
  const pkMatch = path.match(/^\/v1\/projects\/([^/]+)\/provider-keys\/([^/]+)$/);
  if (pkMatch) {
    const [, projectId, provider] = pkMatch;
    if (method === 'PUT') return handlePutProviderKey(request, env, projectId, provider);
    if (method === 'DELETE') return handleDeleteProviderKey(request, env, projectId, provider);
  }

  return null;
}
