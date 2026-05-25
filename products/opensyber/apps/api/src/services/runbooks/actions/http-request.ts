import { z } from 'zod';
import type { ActionFn } from '../types.js';

const paramsSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  // Soft cap to keep step latency bounded in incident response.
  timeout_ms: z.number().int().min(100).max(30000).default(10000),
});

const responseShapeSchema = z.object({
  status: z.number().int(),
  ok: z.boolean(),
  // Body is captured as a string (truncated to 64KB) and parsed JSON when possible.
  body: z.string(),
  json: z.unknown().optional(),
});

const MAX_BODY_BYTES = 64 * 1024;

export const httpRequestAction: ActionFn = async (step) => {
  const parsed = paramsSchema.safeParse(step.params);
  if (!parsed.success) {
    return {
      ok: false,
      error: `http_request: invalid params: ${parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    };
  }

  const { url, method, headers, body, timeout_ms } = parsed.data;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout_ms);

  try {
    const init: RequestInit = {
      method,
      headers: headers ?? {},
      signal: ctrl.signal,
    };
    if (body !== undefined && method !== 'GET') {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
      const h = (init.headers as Record<string, string>);
      if (!h['content-type'] && !h['Content-Type']) {
        h['content-type'] = 'application/json';
      }
    }

    const res = await fetch(url, init);
    const raw = await res.text();
    const truncated = raw.length > MAX_BODY_BYTES ? raw.slice(0, MAX_BODY_BYTES) : raw;
    let json: unknown;
    try {
      json = JSON.parse(truncated);
    } catch {
      json = undefined;
    }

    const shaped = responseShapeSchema.parse({
      status: res.status,
      ok: res.ok,
      body: truncated,
      json,
    });

    return { ok: res.ok, output: shaped };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'http_request failed',
    };
  } finally {
    clearTimeout(timer);
  }
};
