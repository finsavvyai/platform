/**
 * AI Explain Routes
 *
 * LLM-powered threat explanation, compliance narrative, and risk classification.
 * Uses the Anthropic Claude API via claude-client service.
 */
import { Hono } from 'hono';
import {
  explainThreat,
  generateComplianceNarrative,
  classifyRisk,
} from '../services/ai/claude-client.js';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import {
  explainEventSchema,
  complianceNarrativeSchema,
  classifyRiskSchema,
} from './validation/ai-explain.js';

export const aiExplainRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

aiExplainRoutes.use('*', dbMiddleware, authMiddleware, rateLimitMiddleware('ai'));

/** POST /api/ai/explain — Claude-powered threat explanation */
aiExplainRoutes.post('/explain', async (c) => {
  const apiKey = c.env.ANTHROPIC_API_KEY;
  if (!apiKey) return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  const parsed = explainEventSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  try {
    const explanation = await explainThreat(apiKey, parsed.data);
    return c.json({ data: { explanation } });
  } catch (err) {
    console.error('AI explain error:', err);
    return c.json({ error: 'AI explanation unavailable' }, 502);
  }
});

/** POST /api/ai/compliance-narrative — generates auditor-friendly narrative */
aiExplainRoutes.post('/compliance-narrative', async (c) => {
  const apiKey = c.env.ANTHROPIC_API_KEY;
  if (!apiKey) return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  const parsed = complianceNarrativeSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  try {
    const narrative = await generateComplianceNarrative(apiKey, parsed.data.controlResults);
    return c.json({ data: { narrative } });
  } catch (err) {
    console.error('Compliance narrative error:', err);
    return c.json({ error: 'AI explanation unavailable' }, 502);
  }
});

/** POST /api/ai/classify-risk — classify risk level via Claude */
aiExplainRoutes.post('/classify-risk', async (c) => {
  const apiKey = c.env.ANTHROPIC_API_KEY;
  if (!apiKey) return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  const parsed = classifyRiskSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  try {
    const classification = await classifyRisk(apiKey, parsed.data.description);
    return c.json({ data: classification });
  } catch (err) {
    console.error('Risk classification error:', err);
    return c.json({ error: 'AI explanation unavailable' }, 502);
  }
});
