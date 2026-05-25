/**
 * AI Chat Route — Qestro testing copilot
 *
 * POST /api/ai/chat — conversational agent powered by Claude (with failover)
 * Accepts message history for multi-turn context.
 *
 * Abuse protection:
 * - Auth required (no anonymous access)
 * - Rate limit: 20 req/min per user via RATE_LIMIT_KV
 * - Input validation: max 4000 chars/msg, max 50 messages
 *
 * Ported from opensyber's ai-chat.ts with Qestro-specific system prompt
 * and a simplified inline rate limiter (no plan-quota coupling).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/honoAuth';
import { chatWithAgent, type ChatEnv, type ChatMessage } from '../services/ai-chat-agent';

type Bindings = {
  DB: D1Database;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  RATE_LIMIT_KV?: KVNamespace;
  ANTHROPIC_API_KEY?: string;
  GROQ_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  GEMINI_API_KEY?: string;
};

type Env = {
  Bindings: Bindings;
  Variables: { userId: string; userRole: string };
};

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(50),
});

/** Minimal per-user rate limiter using RATE_LIMIT_KV — 20 req/min. */
type RateLimitResult = { ok: true; retryAfter: 0 } | { ok: false; retryAfter: number };

async function checkRateLimit(
  kv: KVNamespace | undefined,
  userId: string,
): Promise<RateLimitResult> {
  if (!kv) return { ok: true, retryAfter: 0 }; // fail-open if KV unbound (dev/test)

  const windowMs = 60_000;
  const limit = 20;
  const now = Date.now();
  const key = `ai-chat:rl:${userId}`;

  const existing = (await kv.get(key, 'json')) as
    | { count: number; resetAt: number }
    | null;

  let entry: { count: number; resetAt: number };
  if (existing && now < existing.resetAt) {
    entry = { count: existing.count + 1, resetAt: existing.resetAt };
  } else {
    entry = { count: 1, resetAt: now + windowMs };
  }

  // KV expirationTtl is seconds, minimum 60
  const ttlSeconds = Math.max(60, Math.ceil(windowMs / 1000));
  await kv.put(key, JSON.stringify(entry), { expirationTtl: ttlSeconds });

  if (entry.count > limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

const aiChatRoute = new Hono<Env>();

aiChatRoute.post('/chat', requireAuth, async (c) => {
  const userId = c.get('userId');

  // Rate limit
  const rl = await checkRateLimit(c.env.RATE_LIMIT_KV, userId);
  if (!rl.ok) {
    return c.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many requests. Slow down and retry shortly.',
        retryAfter: rl.retryAfter,
      },
      429,
    );
  }

  // Parse body
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const parsed = chatSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { success: false, error: 'Invalid request', message: parsed.error.issues[0]?.message },
      400,
    );
  }

  // Resolve provider keys from env bindings (with process.env fallback for dev)
  const env: ChatEnv = {
    ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    GROQ_API_KEY: c.env.GROQ_API_KEY || process.env.GROQ_API_KEY,
    DEEPSEEK_API_KEY: c.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY,
    GEMINI_API_KEY: c.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
  };

  const hasAnyProvider =
    !!env.ANTHROPIC_API_KEY || !!env.GROQ_API_KEY || !!env.DEEPSEEK_API_KEY || !!env.GEMINI_API_KEY;

  if (!hasAnyProvider) {
    return c.json({
      success: true,
      data: {
        reply:
          "I'm Qestro's AI copilot, but no AI provider is configured on this worker yet. " +
          'Set ANTHROPIC_API_KEY (preferred) or GROQ/DEEPSEEK/GEMINI_API_KEY as a secret to enable live chat.',
        provider: 'stub',
      },
    });
  }

  try {
    const msgs = parsed.data.messages as ChatMessage[];
    const { reply, provider } = await chatWithAgent(env, msgs);
    return c.json({ success: true, data: { reply, provider } });
  } catch (err) {
    console.error('[AI Chat] error:', err instanceof Error ? err.message : err);
    return c.json(
      {
        success: false,
        error: 'AI provider error',
        message: 'I hit an error reaching the model. Please try again.',
      },
      502,
    );
  }
});

export default aiChatRoute;
