/**
 * `tokenforge()` middleware.
 *
 * Mounts two default routes:
 *   POST <registerPath>   — proxies to TokenForge /v1/sessions/register,
 *                           sets first-party cookies, swaps refresh_url
 *                           to point at <refreshPath>.
 *   POST <refreshPath>    — proxies DPoP refresh, sets rotated cookie,
 *                           dispatches onStepUp / onRevoked callbacks.
 *
 * Every other request flows through unchanged but gets `c.set('tokenforge')`
 * for use by the customer's own handlers (e.g. issuing a session right
 * after login without going through the SDK's POST).
 */

import type { Context, MiddlewareHandler } from 'hono';
import { TokenForgeClient } from './client.js';
import { toSetCookie } from './cookies.js';
import {
  TokenForgeError,
  type RegisterPassthroughBody,
  type TokenForgeMiddlewareOptions,
} from './types.js';

const DEFAULT_API_BASE = 'https://api.tokenforge.dev';
const DEFAULT_REGISTER_PATH = '/__tokenforge/register';
const DEFAULT_REFRESH_PATH = '/__tokenforge/refresh';

export function tokenforge(opts: TokenForgeMiddlewareOptions): MiddlewareHandler {
  const apiBase = opts.apiBase ?? DEFAULT_API_BASE;
  const registerPath = opts.registerPath ?? DEFAULT_REGISTER_PATH;
  const refreshPath = opts.refreshPath ?? DEFAULT_REFRESH_PATH;
  const client = new TokenForgeClient({
    apiBase,
    appId: opts.appId,
    apiKey: opts.apiKey,
    fetchImpl: opts.fetchImpl,
  });

  return async (c, next) => {
    c.set('tokenforge', client);
    const url = new URL(c.req.url);
    if (c.req.method === 'POST' && url.pathname === registerPath) {
      return await handleRegister(c, opts, client, refreshPath);
    }
    if (c.req.method === 'POST' && url.pathname === refreshPath) {
      return await handleRefresh(c, opts, client);
    }
    await next();
  };
}

async function handleRegister(
  c: Context,
  opts: TokenForgeMiddlewareOptions,
  client: TokenForgeClient,
  refreshPath: string,
): Promise<Response> {
  const auth = await opts.onLogin(c);
  if (!auth) return c.json({ error: 'unauthorized' }, 401);
  const body = (await safeJson(c)) as RegisterPassthroughBody | null;
  if (!body?.public_key_jwk || !body.binding_class) {
    return c.json({ error: 'missing_pubkey' }, 400);
  }
  let result;
  try {
    result = await client.register({
      subject: auth.subject,
      metadata: { ...(auth.metadata ?? {}), ...(body.metadata ?? {}) },
      public_key_jwk: body.public_key_jwk,
      binding_class: body.binding_class,
      client_ip: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? '',
      user_agent: c.req.header('User-Agent') ?? '',
    });
  } catch (e) {
    if (e instanceof TokenForgeError) return c.json({ error: e.message }, 502);
    throw e;
  }
  c.header('Set-Cookie', toSetCookie(result.short_cookie), { append: true });
  c.header('Set-Cookie', toSetCookie(result.long_cookie), { append: true });
  const url = new URL(c.req.url);
  return c.json({
    session_id: result.session_id,
    refresh_url: `${url.origin}${refreshPath}`,
    challenge: result.challenge,
  });
}

async function handleRefresh(
  c: Context,
  opts: TokenForgeMiddlewareOptions,
  client: TokenForgeClient,
): Promise<Response> {
  const dpop = c.req.header('DPoP');
  if (!dpop) return c.json({ error: 'missing_dpop' }, 401);
  let result;
  try {
    result = await client.refresh(dpop);
  } catch (e) {
    if (e instanceof TokenForgeError) {
      return c.json({ error: e.message }, e.status as 401 | 403 | 502);
    }
    throw e;
  }
  c.header('Set-Cookie', toSetCookie(result.short_cookie), { append: true });
  if (result.action === 'step_up') {
    return opts.onStepUp
      ? await opts.onStepUp(c, result.signals ?? [])
      : c.json({ error: 'step_up_required', signals: result.signals ?? [] }, 401);
  }
  if (result.action === 'block') {
    return opts.onRevoked ? await opts.onRevoked(c) : c.json({ error: 'session_revoked' }, 403);
  }
  return c.json({
    challenge: result.challenge,
    signals: result.signals ?? [],
    action: result.action,
  });
}

async function safeJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
