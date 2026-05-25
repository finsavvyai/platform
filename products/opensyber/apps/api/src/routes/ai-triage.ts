/**
 * AI Auto-Triage Routes
 *
 * Classify agent activity events as real threats vs normal activity.
 * Uses Workers AI for enhanced classification when available.
 */
import { Hono } from 'hono';
import { triageEvent, triageEventWithAI, batchTriage } from '../services/auto-triage.js';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { triageEventSchema, batchTriageSchema } from './validation/ai-triage.js';

export const aiTriageRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

aiTriageRoutes.use('*', authMiddleware);

aiTriageRoutes.post('/triage', async (c) => {
  const parsed = triageEventSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);

  const ai = c.env?.AI;
  if (ai) {
    const result = await triageEventWithAI(parsed.data, ai);
    return c.json({ data: result });
  }

  const result = triageEvent(parsed.data);
  return c.json({ data: { ...result, source: 'heuristic' as const } });
});

aiTriageRoutes.post('/triage/batch', async (c) => {
  const parsed = batchTriageSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const results = batchTriage(parsed.data.events);
  return c.json({ data: results });
});
