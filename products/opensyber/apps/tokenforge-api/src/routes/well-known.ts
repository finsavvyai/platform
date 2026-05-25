/**
 * Public well-known endpoints for TokenForge.
 *
 *   /.well-known/tokenforge/jwks
 *     Returns the published JWK set — `active` and `retiring` keys
 *     from `tf_signing_keys`. Empty array when no keys are seeded.
 *     Edge-cached for 5 minutes; key rotation must wait at least one
 *     cache cycle to fully propagate.
 *
 *   /.well-known/tokenforge/dbsc
 *     Service descriptor — endpoints + supported algs. Lets browser
 *     SDKs and partner integrations discover the DBSC surface without
 *     hard-coding paths.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, Variables } from '../types.js';
import { loadPublicJwks } from '../services/keys/key-store.js';

export const wellKnownRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const CACHE_TTL_SECONDS = 300;

async function withEdgeCache(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  body: unknown,
): Promise<Response> {
  const cache =
    typeof caches !== 'undefined' && 'default' in caches
      ? (caches as { default: Cache }).default
      : null;
  const cacheKey = new Request(new URL(c.req.url).toString(), { method: 'GET' });

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const res = c.json(body);
  res.headers.set('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`);

  if (cache) {
    c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  return res;
}

wellKnownRoutes.get('/tokenforge/jwks', async (c) => {
  let keys: unknown[] = [];
  try {
    keys = await loadPublicJwks(c.get('db'));
  } catch {
    // tf_signing_keys may not be migrated yet — fail open with empty JWKS
  }
  return withEdgeCache(c, { keys });
});

wellKnownRoutes.get('/tokenforge/dbsc', async (c) =>
  withEdgeCache(c, {
    issuer: 'https://tokenforge.opensyber.cloud',
    challenge_endpoint: '/v1/dbsc/challenge',
    register_endpoint: '/v1/dbsc/register',
    refresh_endpoint: '/v1/dbsc/refresh',
    revoke_endpoint: '/v1/dbsc/sessions/{id}/revoke',
    cookie_name: '__Secure-tf-bound',
    supported_algs: ['ES256'],
    spec: 'https://w3c.github.io/webappsec-dbsc/',
  }),
);
