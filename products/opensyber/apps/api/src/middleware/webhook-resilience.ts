import type { Context } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { integrationConnections } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { enqueue } from '../services/dead-letter-queue.js';
import {
  checkRateLimit,
  getRateLimitConfig,
} from '../services/rate-limiter.js';
import { cacheIdempotencyResult } from './idempotency.js';

type HonoContext = Context<{ Bindings: Env; Variables: Variables }>;

export interface ResilienceOptions {
  /** Integration source name (e.g., 'github', 'gitlab') */
  source: string;
  /** KV key prefix for rate limiting */
  rateLimitKey?: string;
  /** Function to extract event type from the request */
  getEventType: (c: HonoContext) => string;
}

/**
 * Higher-order function that wraps a webhook handler with resilience:
 * 1. Idempotency check (via context key set by idempotency middleware)
 * 2. Rate limit check (token bucket via KV)
 * 3. Try/catch with DLQ fallback on error
 * 4. Sync health tracking (eventsReceived / consecutiveFailures)
 */
export function withResilience(
  handler: (c: HonoContext) => Promise<Response>,
  options: ResilienceOptions,
) {
  return async (c: HonoContext): Promise<Response> => {
    const kv = c.env.CACHE;
    const rateLimitKey = options.rateLimitKey ?? `webhook:${options.source}`;

    // Rate limit check
    const rlConfig = getRateLimitConfig(options.source);
    const rlResult = await checkRateLimit(kv, rateLimitKey, rlConfig);
    if (!rlResult.allowed) {
      const retryAfter = Math.ceil((rlResult.retryAfterMs ?? 1000) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        { error: 'Rate limited', retryAfterSeconds: retryAfter },
        429,
      );
    }

    try {
      const response = await handler(c);

      // Cache idempotency result if key exists
      const idemKey = c.get('idempotencyKey' as never) as string | undefined;
      if (idemKey) {
        const cloned = response.clone();
        try {
          const body = await cloned.json();
          await cacheIdempotencyResult(kv, idemKey, body, response.status);
        } catch {
          // Non-JSON responses are not cached
        }
      }

      // Record success on integration connections
      await recordSyncSuccess(c, options.source);

      return response;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error';
      console.error(
        `[WebhookResilience] ${options.source} handler failed:`,
        errorMessage,
      );

      // Enqueue to DLQ
      const body = await c.req.raw.clone().text();
      const eventType = options.getEventType(c);
      const db = c.get('db');
      await enqueue(db, {
        source: options.source,
        eventType,
        payload: body.slice(0, 8192),
        error: errorMessage,
      });

      // Record failure on integration connections
      await recordSyncFailure(c, options.source, errorMessage);

      return c.json({ error: 'Processing failed, queued for retry' }, 202);
    }
  };
}

async function recordSyncSuccess(
  c: HonoContext,
  source: string,
): Promise<void> {
  try {
    const db = c.get('db');
    await db
      .update(integrationConnections)
      .set({
        eventsReceived: sql`${integrationConnections.eventsReceived} + 1`,
        consecutiveFailures: 0,
        lastSyncAt: new Date().toISOString(),
      })
      .where(eq(integrationConnections.integrationSlug, source));
  } catch {
    // Best-effort metrics — don't fail the request
  }
}

async function recordSyncFailure(
  c: HonoContext,
  source: string,
  errorMessage: string,
): Promise<void> {
  try {
    const db = c.get('db');
    await db
      .update(integrationConnections)
      .set({
        consecutiveFailures: sql`${integrationConnections.consecutiveFailures} + 1`,
        errorCount: sql`${integrationConnections.errorCount} + 1`,
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: errorMessage.slice(0, 512),
      })
      .where(eq(integrationConnections.integrationSlug, source));
  } catch {
    // Best-effort metrics
  }
}
