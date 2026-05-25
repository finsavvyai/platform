import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { evaluateAchievements } from '../services/achievements.js';
import { ACHIEVEMENT_BY_SLUG } from '@opensyber/shared';

// Authenticated achievements route (dashboard)
const achievementAuthRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

achievementAuthRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// GET /instances/:id/achievements — All achievements for an instance
achievementAuthRoutes.get('/instances/:id/achievements', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('id');
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) {
    return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
  }

  const achievements = await evaluateAchievements(db, instanceId);
  return c.json({ achievements, instanceId });
});

// Public achievements route (shareable cards)
const achievementPublicRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

achievementPublicRoutes.use('*', dbMiddleware);

// GET /:instanceId/:slug — Public single achievement card
achievementPublicRoutes.get('/:instanceId/:slug', async (c) => {
  const instanceId = c.req.param('instanceId');
  const slug = c.req.param('slug');

  const definition = ACHIEVEMENT_BY_SLUG[slug];
  if (!definition) {
    return c.json({ error: 'Not found', message: 'Achievement not found' }, 404);
  }

  const db = c.get('db');
  const achievements = await evaluateAchievements(db, instanceId);
  const achievement = achievements.find((a) => a.slug === slug);

  if (!achievement) {
    return c.json({ error: 'Not found', message: 'Achievement not found' }, 404);
  }

  c.header('Cache-Control', 'public, s-maxage=300');
  return c.json({ achievement });
});

export { achievementAuthRoutes, achievementPublicRoutes };
