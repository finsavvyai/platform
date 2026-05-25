/**
 * AI Chat Route
 *
 * POST /api/ai/chat — conversational agent powered by Claude
 * Accepts message history for multi-turn context.
 *
 * Abuse protection:
 * - Auth required (no anonymous access)
 * - Rate limit: 20 req/min per user (ai tier)
 * - Daily quota: free=10, personal=50, pro=200, team=500
 * - Input validation: max 4000 chars/msg, max 50 messages
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { loadPlanConfig } from '../middleware/plan-enforcement.js';
import type { PlanContext } from '../middleware/plan-enforcement.js';
import { chatWithAgent, streamWithAgent } from '../services/ai/chat-agent.js';

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).min(1).max(50),
});

/** Daily AI message quota per plan. */
const DAILY_QUOTAS: Record<string, number> = {
  free: 10,
  personal: 50,
  pro: 200,
  team: 500,
};

export const aiChatRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
aiChatRoutes.use('*', dbMiddleware, authMiddleware, rateLimitMiddleware('ai'), loadPlanConfig);

aiChatRoutes.post('/chat', async (c) => {
  const apiKey = c.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return c.json({ data: { reply: 'The AI assistant is coming soon! In the meantime, check our docs at opensyber.cloud/docs for help with setup and configuration.' } });
  }

  const userId = c.get('userId');
  const planContext = c.get('planConfig') as PlanContext | undefined;
  const plan = planContext?.plan ?? 'free';
  const dailyLimit = DAILY_QUOTAS[plan] ?? DAILY_QUOTAS.free;

  // Check daily usage quota via KV
  const today = new Date().toISOString().slice(0, 10);
  const quotaKey = `ai-chat:daily:${userId}:${today}`;
  const usageRaw = await c.env.CACHE.get(quotaKey);
  const usage = usageRaw ? parseInt(usageRaw, 10) : 0;

  if (usage >= dailyLimit!) {
    return c.json({
      error: 'Daily limit reached',
      message: `You've used all ${dailyLimit} AI messages for today. Resets at midnight UTC.`,
      upgradeRequired: plan === 'free' || plan === 'personal',
      currentPlan: plan,
      usage,
      limit: dailyLimit,
    }, 429);
  }

  const body = chatSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: 'Invalid request', message: body.error.issues[0]?.message }, 400);
  }

  try {
    const reply = await chatWithAgent(apiKey, body.data.messages);

    // Increment the daily counter in the background — the reply is
    // already in hand, the user shouldn't wait for a KV propagation
    // round-trip just to bump a quota counter. Off-by-one across
    // concurrent requests is fine on a daily window. c.executionCtx
    // is a throwing getter in test env, hence the try/catch.
    const secondsUntilMidnight = getSecondsUntilMidnightUTC();
    const putPromise = c.env.CACHE.put(quotaKey, String(usage + 1), {
      expirationTtl: secondsUntilMidnight + 60,
    });
    try {
      c.executionCtx.waitUntil(putPromise);
    } catch {
      void putPromise.catch(() => {});
    }

    return c.json({ data: { reply } });
  } catch (err) {
    console.error('[AI Chat] Error:', err instanceof Error ? err.message : err);
    return c.json({ data: { reply: 'I encountered an error processing your request. Please try again.' } });
  }
});

function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
  ));
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

async function bumpDailyQuota(
  c: {
    env: Env;
    executionCtx: { waitUntil: (p: Promise<unknown>) => void };
  },
  key: string,
  next: number,
): Promise<void> {
  const ttl = getSecondsUntilMidnightUTC() + 60;
  const put = c.env.CACHE.put(key, String(next), { expirationTtl: ttl });
  try {
    c.executionCtx.waitUntil(put);
  } catch {
    void put.catch(() => {});
  }
}

aiChatRoutes.post('/chat/stream', async (c) => {
  const apiKey = c.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'AI unavailable', message: 'Streaming requires a provisioned Anthropic key' }, 503);
  }

  const userId = c.get('userId');
  const planContext = c.get('planConfig') as PlanContext | undefined;
  const plan = planContext?.plan ?? 'free';
  const dailyLimit = DAILY_QUOTAS[plan] ?? DAILY_QUOTAS.free!;
  const today = new Date().toISOString().slice(0, 10);
  const quotaKey = `ai-chat:daily:${userId}:${today}`;
  const usage = parseInt((await c.env.CACHE.get(quotaKey)) ?? '0', 10);
  if (usage >= dailyLimit) {
    return c.json({ error: 'Daily limit reached', usage, limit: dailyLimit }, 429);
  }

  const body = chatSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ error: 'Invalid request', message: body.error.issues[0]?.message }, 400);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of streamWithAgent(apiKey, body.data.messages)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'stream error';
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  await bumpDailyQuota(c, quotaKey, usage + 1);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
