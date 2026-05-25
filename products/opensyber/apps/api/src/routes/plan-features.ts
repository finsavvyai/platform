import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { users } from '@opensyber/db';
import type { Plan } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { getPlanFeatures } from '../services/plan-enforcement.js';

const planFeatureRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

planFeatureRoutes.use('*', dbMiddleware, authMiddleware);

// Get current plan features
planFeatureRoutes.get('/features', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return c.json({ error: 'Not found', message: 'User not found' }, 404);
  }

  const features = getPlanFeatures(user.plan as Plan);
  return c.json({ data: features });
});

export { planFeatureRoutes };
