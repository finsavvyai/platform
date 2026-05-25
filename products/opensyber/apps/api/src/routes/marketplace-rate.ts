/**
 * Marketplace Rating Routes
 *
 * POST /api/marketplace/:id/rate — Rate a skill (create or update)
 * GET  /api/marketplace/:id/ratings — List ratings for a skill
 */
import { Hono } from 'hono';
import { eq, and, avg, count } from 'drizzle-orm';
import { z } from 'zod';
import { skills, marketplaceRatings } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';

const rateSkillSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(2000).optional(),
});

const marketplaceRateRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

marketplaceRateRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Rate a skill (upsert)
marketplaceRateRoutes.post('/:id/rate', requirePermission('marketplace.browse'), async (c) => {
  const db = c.get('db');
  const skillId = c.req.param('id');
  const userId = c.get('userId');

  const parsed = rateSkillSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const [skill] = await db.select().from(skills).where(eq(skills.id, skillId));
  if (!skill) return c.json({ error: 'Skill not found' }, 404);

  // Check for existing rating
  const [existing] = await db.select().from(marketplaceRatings)
    .where(and(eq(marketplaceRatings.skillId, skillId), eq(marketplaceRatings.userId, userId)));

  if (existing) {
    await db.update(marketplaceRatings).set({
      rating: body.rating, review: body.review ?? existing.review,
      updatedAt: new Date().toISOString(),
    }).where(eq(marketplaceRatings.id, existing.id));
  } else {
    await db.insert(marketplaceRatings).values({
      id: crypto.randomUUID(), skillId, userId,
      rating: body.rating, review: body.review ?? null,
    });
  }

  // Recalculate aggregates
  const [agg] = await db.select({
    avgRating: avg(marketplaceRatings.rating),
    totalCount: count(),
  }).from(marketplaceRatings).where(eq(marketplaceRatings.skillId, skillId));

  await db.update(skills).set({
    ratingAvg: Number(agg?.avgRating ?? 0),
    ratingCount: agg?.totalCount ?? 0,
  }).where(eq(skills.id, skillId));

  return c.json({ data: { rating: body.rating, review: body.review } });
});

// List ratings
marketplaceRateRoutes.get('/:id/ratings', requirePermission('marketplace.browse'), async (c) => {
  const db = c.get('db');
  const ratings = await db.select().from(marketplaceRatings)
    .where(eq(marketplaceRatings.skillId, c.req.param('id')));
  return c.json({ data: ratings });
});

export { marketplaceRateRoutes };
