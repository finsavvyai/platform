/**
 * Credits & Achievements routes
 *
 * GET  /credits            — user balance + achievements
 * POST /credits/earn       — record an action (auto-calculates reward)
 * GET  /credits/leaderboard — top 20 users by lifetime credits
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuth } from '../middleware/auth';
import { validateJson } from '../middleware/validation';
import { creditEarnSchema } from '../schemas/credit-schemas';
import {
  addCredits,
  getCredits,
  getAchievements,
  checkMilestones,
  VALID_ACTIONS,
} from '../services/credits';

export const creditRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /credits — current balance, achievements, and available actions
 */
creditRoutes.get('/', requireAuth, async (c) => {
  const userId = c.get('userId');

  const [balance, achievements] = await Promise.all([
    getCredits(c.env.DB, userId),
    getAchievements(c.env.DB, userId),
  ]);

  return c.json({
    balance,
    achievements,
    availableActions: VALID_ACTIONS,
  });
});

/**
 * POST /credits/earn — record a credit-earning action
 * Body: { action: string }
 */
creditRoutes.post('/earn', requireAuth, validateJson(creditEarnSchema), async (c) => {
  const userId = c.get('userId');
  const { action } = c.req.valid('json');

  const newBalance = await addCredits(c.env.DB, userId, action);
  const newAchievements = await checkMilestones(c.env.DB, userId);

  return c.json({
    balance: newBalance,
    action,
    newAchievements,
  });
});

/**
 * GET /credits/leaderboard — top 20 users by lifetime earned credits
 */
creditRoutes.get('/leaderboard', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT uc.user_id, uc.lifetime_earned, uc.balance, u.name, u.email
     FROM user_credits uc
     LEFT JOIN users u ON u.id = uc.user_id
     ORDER BY uc.lifetime_earned DESC
     LIMIT 20`,
  ).all<{
    user_id: string;
    lifetime_earned: number;
    balance: number;
    name: string | null;
    email: string | null;
  }>();

  const leaderboard = (result.results ?? []).map((row, index) => ({
    rank: index + 1,
    userId: row.user_id,
    name: row.name || 'Anonymous',
    lifetimeEarned: row.lifetime_earned,
    currentBalance: row.balance,
  }));

  return c.json({ leaderboard });
});
