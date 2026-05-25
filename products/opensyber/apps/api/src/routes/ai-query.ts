/**
 * AI Natural Language Query Routes
 *
 * Allows users to query agent activity using natural language.
 */
import { Hono } from 'hono';
import {
  translateNaturalLanguageQuery, describeFilter, isFilterEmpty, translateWithAI,
} from '../services/nl-query-translator.js';
import { aiQueryHistory } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { aiQuerySchema } from './validation/ai-query.js';

export const aiQueryRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

aiQueryRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

aiQueryRoutes.post('/query', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const parsed = aiQuerySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const query = parsed.data.query;

  let filter = translateNaturalLanguageQuery(query);
  let source: 'pattern' | 'ai' = 'pattern';

  if (isFilterEmpty(filter) && c.env.AI) {
    filter = await translateWithAI(query, c.env.AI as { run: (model: string, input: unknown) => Promise<{ response?: string }> });
    source = 'ai';
  }

  const description = describeFilter(filter);
  const id = crypto.randomUUID();

  await db.insert(aiQueryHistory).values({
    id,
    orgId,
    query,
    translatedFilter: JSON.stringify(filter),
    resultCount: 0,
  });

  return c.json({ data: { id, filter, description, source } });
});
