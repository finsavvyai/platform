/** Public /v1/demo endpoint for the playground try-it panel.
 *
 * Rate-limited per IP via KV. Always routes to Groq's free-tier Llama-3.1-8B.
 * Max 60 output tokens to bound cost and discourage scraper abuse.
 * No API key required from the client — that's the whole point.
 */

import type { Env } from './types';
import { groqAdapter } from './providers/groq';

const HOURLY_LIMIT = 5;
const DAILY_GLOBAL_CAP = 2000;
const MAX_PROMPT_CHARS = 500;
const MAX_OUTPUT_TOKENS = 60;

export async function handleDemo(request: Request, env: Env): Promise<Response> {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  const now = new Date();
  const hour = Math.floor(now.getTime() / 3_600_000);
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const ipKey = `demo:${ip}:${hour}`;
  const globalKey = `demo:global:${day}`;

  // Per-IP hourly limit
  const countStr = await env.CACHE.get(ipKey);
  const count = countStr ? parseInt(countStr, 10) : 0;
  if (count >= HOURLY_LIMIT) {
    return Response.json(
      {
        error: `Demo limit reached (${HOURLY_LIMIT}/hour). Sign up free at https://app.clawpipe.ai/signup for 1,000 calls/day.`,
      },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0' } },
    );
  }

  // Global daily ceiling (prevents IP-rotation abuse draining the free tier)
  const globalStr = await env.CACHE.get(globalKey);
  const globalCount = globalStr ? parseInt(globalStr, 10) : 0;
  if (globalCount >= DAILY_GLOBAL_CAP) {
    return Response.json(
      {
        error: 'Demo quota exhausted for today. Come back tomorrow, or sign up free at https://app.clawpipe.ai/signup.',
      },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0' } },
    );
  }

  let body: { prompt?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.prompt || typeof body.prompt !== 'string') {
    return Response.json({ error: 'Missing prompt' }, { status: 400 });
  }
  if (body.prompt.length > MAX_PROMPT_CHARS) {
    return Response.json(
      { error: `Prompt too long (max ${MAX_PROMPT_CHARS} characters)` },
      { status: 400 },
    );
  }

  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Demo unavailable (provider not configured)' }, { status: 503 });
  }

  try {
    const result = await groqAdapter.call(
      {
        prompt: body.prompt,
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        maxTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
      },
      apiKey,
    );

    await env.CACHE.put(ipKey, String(count + 1), { expirationTtl: 3700 });
    // Global daily counter — 36h TTL gives slack across timezone midnight.
    await env.CACHE.put(globalKey, String(globalCount + 1), { expirationTtl: 129_600 });
    const remaining = HOURLY_LIMIT - count - 1;

    return Response.json(
      {
        text: result.text,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        latencyMs: result.latencyMs,
        model: 'groq:llama-3.1-8b-instant',
        remaining,
      },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Demo call failed';
    return Response.json({ error: message }, { status: 502 });
  }
}
