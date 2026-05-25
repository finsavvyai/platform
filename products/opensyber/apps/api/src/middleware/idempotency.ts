import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

/**
 * Compute SHA-256 hash of source + eventType + payload for idempotency key.
 */
async function computeIdempotencyKey(
  source: string,
  eventType: string,
  payload: unknown,
): Promise<string> {
  const input = `${source}:${eventType}:${JSON.stringify(payload)}`;
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Options for the idempotency middleware.
 * @param source - Integration source name (e.g., 'github', 'gitlab')
 * @param getEventType - Extract event type from request (header, param, etc.)
 */
export interface IdempotencyOptions {
  source: string;
  getEventType: (c: any) => string;
}

/**
 * Middleware that deduplicates webhook deliveries using KV-backed SHA-256 hashing.
 * Returns cached response if the same (source, eventType, payload) was already processed.
 */
export function idempotencyMiddleware(options: IdempotencyOptions) {
  return createMiddleware<{ Bindings: Env; Variables: Variables }>(
    async (c, next) => {
      const body = await c.req.raw.clone().text();
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        payload = body;
      }

      const eventType = options.getEventType(c);
      const hash = await computeIdempotencyKey(
        options.source,
        eventType,
        payload,
      );
      const kvKey = `idem:${hash}`;

      const cached = await c.env.CACHE.get(kvKey);
      if (cached) {
        const cachedResponse = JSON.parse(cached);
        return c.json(cachedResponse.body, cachedResponse.status);
      }

      // Store the hash on context so the resilience wrapper can cache the result
      c.set('idempotencyKey' as never, kvKey as never);

      await next();
    },
  );
}

/**
 * Store a successful response in KV for idempotency dedup.
 */
export async function cacheIdempotencyResult(
  kv: KVNamespace,
  key: string,
  body: unknown,
  status: number,
): Promise<void> {
  await kv.put(
    key,
    JSON.stringify({ body, status }),
    { expirationTtl: IDEMPOTENCY_TTL_SECONDS },
  );
}
