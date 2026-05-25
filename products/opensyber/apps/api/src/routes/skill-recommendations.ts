/**
 * Skill Recommendation Routes
 *
 * GET /api/marketplace/recommendations — context-aware skill suggestions
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { instances, skills } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import {
  getRecommendations,
  type SkillRecommendation,
} from '../services/skill-recommendations.js';
import {
  getVectorRecommendations,
  type VectorRecommendationContext,
} from '../services/skill-recommendations-vector.js';

export const skillRecommendationRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

skillRecommendationRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// GET /recommendations — personalized skill suggestions
skillRecommendationRoutes.get('/recommendations', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  // Get user's instances
  const userInstances = await db
    .select({ id: instances.id })
    .from(instances)
    .where(eq(instances.userId, userId));

  const instanceIds = userInstances.map((i) => i.id);

  // Try vector-based semantic recommendations first, fall back to rules
  // when Vectorize/AI bindings are unavailable or return no matches.
  const ctx = { userId, orgId, instanceIds };
  let recommendations = await tryVectorRecommendations(c, db, ctx);
  if (recommendations.length === 0) {
    recommendations = await getRecommendations(db, ctx);
  }

  // Enrich with full skill data
  const enriched = await Promise.all(
    recommendations.map(async (rec) => {
      const [skill] = await db
        .select()
        .from(skills)
        .where(eq(skills.slug, rec.skillSlug));
      return { ...rec, skill: skill ?? null };
    }),
  );

  // Filter out recommendations where skill doesn't exist
  const valid = enriched.filter((r) => r.skill !== null);

  return c.json({ data: valid });
});

/**
 * Attempt vector-based recommendations. Swallows errors so the caller
 * can fall back to the rule-based engine without failing the request.
 */
async function tryVectorRecommendations(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  db: DrizzleD1Database<Record<string, unknown>>,
  ctx: VectorRecommendationContext,
): Promise<SkillRecommendation[]> {
  try {
    return await getVectorRecommendations(c.env.AI, c.env.VECTORIZE, db, ctx);
  } catch {
    return [];
  }
}
