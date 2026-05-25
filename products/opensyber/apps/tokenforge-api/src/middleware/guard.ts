/**
 * Guard middleware — validates request bodies against prompt injection
 * via the self-hosted Claw gateway /v1/guard endpoint.
 *
 * Scans string fields in POST/PUT/PATCH bodies. Blocks requests where
 * any field is classified as a prompt injection attempt.
 *
 * Fail-open: if the guard endpoint is unreachable, requests proceed.
 */

import type { Context, Next } from 'hono';
import type { Env, Variables } from '../types.js';

const GUARD_TIMEOUT_MS = 2000;

/** Extract all string values from a request body for scanning */
function extractStrings(body: Record<string, unknown>): string[] {
  const strings: string[] = [];
  for (const value of Object.values(body)) {
    if (typeof value === 'string' && value.length > 3) {
      strings.push(value);
    }
  }
  return strings;
}

/**
 * Hono middleware — scans POST/PUT/PATCH bodies through Claw guard.
 * Attach after tenantAuth on /v1/* routes.
 */
export function guardMiddleware() {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const method = c.req.method;
    if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
      return next();
    }

    const guardUrl = (c.env as unknown as Record<string, string>).CLAW_GATEWAY_URL;
    const guardKey = (c.env as unknown as Record<string, string>).CLAW_API_KEY;
    if (!guardUrl || !guardKey) return next();

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return next();
    }

    const inputs = extractStrings(body);
    if (inputs.length === 0) return next();

    const combined = inputs.join('\n---\n');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GUARD_TIMEOUT_MS);

      const res = await fetch(`${guardUrl}/v1/guard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guardKey}`,
        },
        body: JSON.stringify({ input: combined }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const result = (await res.json()) as {
          classification: string;
          violationTypes?: string[];
        };

        if (result.classification === 'block') {
          console.warn('[Guard] Blocked injection in TokenForge request', {
            violations: result.violationTypes,
            tenantId: c.get('tenantId'),
            path: c.req.path,
          });

          return c.json({
            error: 'input_blocked',
            message: 'Request blocked by security guard',
            violations: result.violationTypes ?? [],
          }, 400);
        }
      }
    } catch {
      // Fail-open: guard unreachable, let request through
    }

    await next();
  };
}
