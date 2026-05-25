/** Idempotency-Key middleware for POST endpoints.
 *
 * Stores a (projectId, key) -> serialized response in KV for 24 h. Subsequent
 * requests with the same key return the cached response with header
 * `Idempotency-Replay: HIT`. Prevents accidental double-charges from retries.
 *
 * Spec: https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/
 */

import type { Env } from './types';

export const IDEMPOTENCY_TTL_SEC = 86_400;
export const MAX_KEY_LEN = 200;
const KEY_RE = /^[A-Za-z0-9_.-]{1,200}$/;

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  storedAt: number;
}

export function isValidKey(key: string | null): key is string {
  return !!key && KEY_RE.test(key);
}

function cacheKey(projectId: string, key: string): string {
  return `idem:${projectId}:${key}`;
}

/** Look up a previously-stored response. Returns null on miss or parse fail. */
export async function getIdempotent(
  env: Env, projectId: string, key: string,
): Promise<Response | null> {
  const raw = await env.CACHE.get(cacheKey(projectId, key));
  if (!raw) return null;
  let cached: CachedResponse;
  try { cached = JSON.parse(raw) as CachedResponse; }
  catch { return null; }
  const headers = new Headers(cached.headers);
  headers.set('Idempotency-Replay', 'HIT');
  return new Response(cached.body, { status: cached.status, headers });
}

/** Store a response under the idempotency key. Clones the response so the
 *  original can still be read by the caller. */
export async function saveIdempotent(
  env: Env, projectId: string, key: string, response: Response,
): Promise<Response> {
  // Only cache 2xx responses — replaying a 4xx/5xx serves no purpose and
  // hides transient errors that the client should retry against fresh state.
  if (response.status < 200 || response.status >= 300) return response;
  const clone = response.clone();
  const body = await clone.text();
  const headers: Record<string, string> = {};
  clone.headers.forEach((v, k) => { headers[k] = v; });
  const cached: CachedResponse = {
    status: clone.status, headers, body, storedAt: Date.now(),
  };
  await env.CACHE.put(
    cacheKey(projectId, key), JSON.stringify(cached),
    { expirationTtl: IDEMPOTENCY_TTL_SEC },
  );
  return response;
}

/** Read + validate the Idempotency-Key header. Returns null when absent;
 *  throws Response(400) when present-but-malformed so the caller can return. */
export function readKey(request: Request): string | null | Response {
  const raw = request.headers.get('Idempotency-Key');
  if (raw == null) return null;
  if (!isValidKey(raw)) {
    return Response.json(
      { error: 'Invalid Idempotency-Key — must match [A-Za-z0-9_.-]{1,200}' },
      { status: 400 },
    );
  }
  return raw;
}
