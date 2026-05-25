/**
 * Tracing middleware — attaches a Perfetto-compatible TraceCollector
 * to each request. Captures request lifecycle timing automatically.
 *
 * Traces are stored in KV (CACHE namespace) for admin retrieval.
 * Header `X-Trace-Id` is returned for trace lookup.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types.js';
import { createTrace } from '../services/trace.js';

type HonoEnv = { Bindings: Env; Variables: Variables & { trace: ReturnType<typeof createTrace> } };

export const traceMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const trace = createTrace();
  c.set('trace', trace);

  const traceId = crypto.randomUUID();
  const requestSpan = trace.startSpan('request', {
    method: c.req.method,
    path: c.req.path,
    traceId,
  });

  await next();

  requestSpan.end();

  c.header('X-Trace-Id', traceId);

  // Store trace in KV (async, non-blocking) — 1 hour TTL. Also persist the
  // org/user context alongside so that the retrieval route can enforce
  // ownership before returning trace contents to admins of other tenants.
  const traceData = trace.toJSON();
  const orgId = (c.get as unknown as (k: string) => string | undefined)('orgId') ?? null;
  const userId = (c.get as unknown as (k: string) => string | undefined)('userId') ?? null;
  const owner = JSON.stringify({ orgId, userId, storedAt: new Date().toISOString() });
  c.executionCtx.waitUntil(Promise.all([
    c.env.CACHE.put(`trace:${traceId}`, traceData, { expirationTtl: 3600 }),
    c.env.CACHE.put(`trace:${traceId}:owner`, owner, { expirationTtl: 3600 }),
  ]));
};
