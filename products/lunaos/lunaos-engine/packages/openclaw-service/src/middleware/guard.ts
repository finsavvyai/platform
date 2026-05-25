/**
 * Claw Guard middleware for LunaOS OpenClaw service.
 *
 * Guards all incoming messages (from Slack, WhatsApp, Discord, Telegram,
 * and direct execution) through the self-hosted Claw /v1/guard endpoint.
 * Detects prompt injection before messages reach LLM processing.
 *
 * Fail-open: if guard is unreachable, requests proceed.
 */

import type { Context, Next } from 'hono';

const GUARD_TIMEOUT_MS = 2000;

interface GuardResult {
  classification: 'pass' | 'block';
  violationTypes?: string[];
}

/**
 * Extract the user message from bridge/channel request bodies.
 */
function extractMessage(body: Record<string, unknown>): string | null {
  if (typeof body.message === 'string') return body.message;
  if (typeof body.prompt === 'string') return body.prompt;
  if (typeof body.input === 'string') return body.input;
  if (typeof body.text === 'string') return body.text;
  if (typeof body.query === 'string') return body.query;
  return null;
}

/**
 * Hono middleware — guards POST bodies through Claw /v1/guard.
 */
export function clawGuard() {
  return async (c: Context, next: Next) => {
    if (c.req.method !== 'POST') return next();

    const env = c.env as Record<string, string>;
    const guardUrl = env.CLAW_GATEWAY_URL;
    const guardKey = env.CLAW_API_KEY;
    if (!guardUrl || !guardKey) return next();

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return next();
    }

    const message = extractMessage(body);
    if (!message || message.length < 5) return next();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GUARD_TIMEOUT_MS);

      const res = await fetch(`${guardUrl}/v1/guard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guardKey}`,
        },
        body: JSON.stringify({ input: message }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const result = (await res.json()) as GuardResult;
        if (result.classification === 'block') {
          return c.json({
            error: 'blocked',
            message: 'Input blocked by security guard',
            violations: result.violationTypes ?? [],
          }, 400);
        }
      }
    } catch {
      // fail-open
    }

    await next();
  };
}
