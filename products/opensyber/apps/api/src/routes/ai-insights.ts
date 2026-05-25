/**
 * AI Insights CRUD Routes
 *
 * Manage AI-generated insights and recommendations.
 */
import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { aiInsights, aiRecommendations } from '@opensyber/db';
import { generateComplianceNarrative } from '../services/compliance-narrative.js';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { createInsightSchema, updateInsightSchema, complianceNarrativeSchema } from './validation/ai-insights.js';

export const aiInsightRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

aiInsightRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

aiInsightRoutes.get('/insights', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const insights = await db.select().from(aiInsights)
    .where(eq(aiInsights.orgId, orgId))
    .orderBy(desc(aiInsights.createdAt))
    .limit(50);
  return c.json({ data: insights });
});

aiInsightRoutes.post('/insights', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const parsed = createInsightSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const id = crypto.randomUUID();
  await db.insert(aiInsights).values({
    id, orgId,
    category: parsed.data.category,
    severity: parsed.data.severity,
    title: parsed.data.title,
    description: parsed.data.description,
    sourceType: parsed.data.sourceType,
    sourceId: parsed.data.sourceId ?? null,
  });
  return c.json({ data: { id } }, 201);
});

aiInsightRoutes.patch('/insights/:id', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const parsed = updateInsightSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  await db.update(aiInsights)
    .set({ status: parsed.data.status })
    .where(and(eq(aiInsights.id, c.req.param('id')), eq(aiInsights.orgId, orgId)));
  return c.json({ data: { updated: true } });
});

aiInsightRoutes.get('/recommendations', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const recs = await db.select().from(aiRecommendations)
    .where(eq(aiRecommendations.orgId, orgId))
    .orderBy(desc(aiRecommendations.createdAt))
    .limit(20);
  return c.json({ data: recs });
});

aiInsightRoutes.post('/compliance-narrative', async (c) => {
  const parsed = complianceNarrativeSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const narrative = generateComplianceNarrative(parsed.data.controls as Parameters<typeof generateComplianceNarrative>[0]);
  return c.json({ data: narrative });
});
