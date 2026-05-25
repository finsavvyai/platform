/**
 * Bundle API Routes
 *
 * GET  /api/bundles              — List all bundles with skills + user status
 * POST /api/bundles/:id/activate — Activate a bundle subscription
 * GET  /api/user/bundles         — User's active bundle subscriptions
 */
import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import {
  skillBundles, bundleSkills, userBundleSubscriptions, skills,
} from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';

type AppEnv = { Bindings: Env; Variables: Variables };

const bundleRoutes = new Hono<AppEnv>();
const userBundleRoutes = new Hono<AppEnv>();

bundleRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);
userBundleRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/** List all active bundles with their skills and user subscription status */
bundleRoutes.get('/', requirePermission('marketplace.browse'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const allBundles = await db.select().from(skillBundles)
    .where(eq(skillBundles.isActive, true))
    .orderBy(skillBundles.sortOrder);

  const allBundleSkills = await db.select({
    bundleId: bundleSkills.bundleId,
    skillId: bundleSkills.skillId,
    skillName: skills.name,
    skillSlug: skills.slug,
    skillCategory: skills.category,
    sortOrder: bundleSkills.sortOrder,
  }).from(bundleSkills)
    .innerJoin(skills, eq(bundleSkills.skillId, skills.id))
    .orderBy(bundleSkills.sortOrder);

  const userSubs = await db.select().from(userBundleSubscriptions)
    .where(and(
      eq(userBundleSubscriptions.userId, userId),
      eq(userBundleSubscriptions.status, 'active'),
    ));

  const subsByBundle = new Map(userSubs.map((s) => [s.bundleId, s]));
  const skillsByBundle = new Map<string, typeof allBundleSkills>();
  for (const bs of allBundleSkills) {
    const list = skillsByBundle.get(bs.bundleId) ?? [];
    list.push(bs);
    skillsByBundle.set(bs.bundleId, list);
  }

  const data = allBundles.map((b) => ({
    ...b,
    skills: skillsByBundle.get(b.id) ?? [],
    subscription: subsByBundle.get(b.id) ?? null,
    isSubscribed: subsByBundle.has(b.id),
  }));

  return c.json({ data });
});

/** Activate a bundle subscription */
const activateSchema = z.object({
  returnUrl: z.string().url().optional(),
});

bundleRoutes.post('/:id/activate', requirePermission('marketplace.browse'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const bundleId = c.req.param('id');

  const [bundle] = await db.select().from(skillBundles)
    .where(and(eq(skillBundles.id, bundleId), eq(skillBundles.isActive, true)));

  if (!bundle) return c.json({ error: 'Bundle not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = activateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  // Check existing active subscription
  const [existing] = await db.select().from(userBundleSubscriptions)
    .where(and(
      eq(userBundleSubscriptions.userId, userId),
      eq(userBundleSubscriptions.bundleId, bundleId),
      eq(userBundleSubscriptions.status, 'active'),
    ));

  if (existing) {
    return c.json({ data: { subscription: existing, alreadyActive: true } });
  }

  // Free bundles activate immediately
  if (bundle.priceCents === 0) {
    const subId = crypto.randomUUID();
    await db.insert(userBundleSubscriptions).values({
      id: subId,
      userId,
      bundleId,
      status: 'active',
    });

    const [sub] = await db.select().from(userBundleSubscriptions)
      .where(eq(userBundleSubscriptions.id, subId));

    return c.json({ data: { subscription: sub, activated: true } });
  }

  // Paid bundles require payment — redirect to checkout
  return c.json(
    { error: 'Payment required', checkoutUrl: '/pricing' },
    402,
  );
});

/** User's active bundle subscriptions */
userBundleRoutes.get('/', requirePermission('marketplace.browse'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const subs = await db.select({
    subscription: userBundleSubscriptions,
    bundle: skillBundles,
  }).from(userBundleSubscriptions)
    .innerJoin(skillBundles, eq(userBundleSubscriptions.bundleId, skillBundles.id))
    .where(eq(userBundleSubscriptions.userId, userId))
    .orderBy(desc(userBundleSubscriptions.startedAt));

  const data = subs.map((row) => ({
    ...row.subscription,
    bundle: row.bundle,
  }));

  return c.json({ data });
});

export { bundleRoutes, userBundleRoutes };
