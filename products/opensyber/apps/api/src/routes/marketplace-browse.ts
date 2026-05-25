/**
 * Marketplace Browse Routes
 *
 * GET /api/marketplace           — List/search skills
 * GET /api/marketplace/featured  — Featured skills
 * GET /api/marketplace/:id       — Skill detail
 */
import { Hono } from 'hono';
import { eq, like, desc, and } from 'drizzle-orm';
import { skills } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { escapeLike } from '../utils/escape-like.js';
import { getTrustIndicators } from '../lib/skill-artifact-trust.js';

const marketplaceBrowseRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

marketplaceBrowseRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Marketplace data is read-mostly — approved skills change on minute scale.
// Cache at the edge for anonymous-equivalent responses, but keep per-user
// semantics with `private` since requirePermission may differ by plan.
const MARKETPLACE_CACHE = 'private, max-age=60, stale-while-revalidate=300';

function withTrustIndicators<T extends { manifest: string | null }>(skill: T): T & { isSigned: boolean; hasSbom: boolean } {
  const indicators = getTrustIndicators(skill.manifest);
  return { ...skill, ...indicators };
}

// List/search marketplace skills
marketplaceBrowseRoutes.get('/', requirePermission('marketplace.browse'), async (c) => {
  const db = c.get('db');
  const q = c.req.query('q');
  const category = c.req.query('category');
  const tier = c.req.query('tier');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 50);

  type SkillCategory = 'productivity' | 'developer' | 'finance' | 'communication' | 'home' | 'security' | 'utilities';
  type SkillTier = 'free' | 'pro' | 'premium';
  const validCategories: ReadonlySet<string> = new Set(['productivity', 'developer', 'finance', 'communication', 'home', 'security', 'utilities']);
  const validTiers: ReadonlySet<string> = new Set(['free', 'pro', 'premium']);

  const conditions = [eq(skills.verificationStatus, 'approved')];
  if (category && validCategories.has(category)) conditions.push(eq(skills.category, category as SkillCategory));
  if (tier && validTiers.has(tier)) conditions.push(eq(skills.tier, tier as SkillTier));
  if (q) conditions.push(like(skills.name, `%${escapeLike(q)}%`));

  const results = await db.select().from(skills)
    .where(and(...conditions))
    .orderBy(desc(skills.installCount))
    .limit(limit);

  c.header('Cache-Control', MARKETPLACE_CACHE);
  return c.json({ data: results.map(withTrustIndicators) });
});

// Featured skills
marketplaceBrowseRoutes.get('/featured', requirePermission('marketplace.browse'), async (c) => {
  const db = c.get('db');
  const results = await db.select().from(skills)
    .where(and(eq(skills.verificationStatus, 'approved'), eq(skills.isFeatured, true)))
    .orderBy(desc(skills.installCount))
    .limit(10);
  // Featured list is curated and changes rarely — cache aggressively.
  c.header('Cache-Control', 'private, max-age=300, stale-while-revalidate=900');
  return c.json({ data: results.map(withTrustIndicators) });
});

// Skill detail
marketplaceBrowseRoutes.get('/:id', requirePermission('marketplace.browse'), async (c) => {
  const db = c.get('db');
  const [skill] = await db.select().from(skills).where(eq(skills.id, c.req.param('id')));
  if (!skill) return c.json({ error: 'Skill not found' }, 404);
  c.header('Cache-Control', MARKETPLACE_CACHE);
  return c.json({ data: withTrustIndicators(skill) });
});

export { marketplaceBrowseRoutes };
