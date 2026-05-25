import { Hono } from 'hono';
import { eq, count } from 'drizzle-orm';
import { users, instances, skillInstallations, alertRules, credentials } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { updateOnboardingSchema } from './validation/user.js';
import { alertPrefsRoutes } from './handlers/user-alert-prefs.js';

const userRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

userRoutes.use('*', dbMiddleware, authMiddleware);

// Get current user profile
userRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: 'Not found', message: 'User not found' }, 404);
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      createdAt: user.createdAt,
      onboardingCompletedAt: user.onboardingCompletedAt,
      referralCode: user.referralCode,
    },
  });
});

// Get onboarding progress
userRoutes.get('/onboarding', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: 'Not found', message: 'User not found' }, 404);
  }

  const userInstances = await db
    .select()
    .from(instances)
    .where(eq(instances.userId, userId))
    .limit(1);
  const deployAgent = userInstances.length > 0;

  const userSkillInstallations = await db
    .select()
    .from(skillInstallations)
    .innerJoin(instances, eq(skillInstallations.instanceId, instances.id))
    .where(eq(instances.userId, userId))
    .limit(1);
  const installSkill = userSkillInstallations.length > 0;

  const userAlertRules = await db
    .select()
    .from(alertRules)
    .innerJoin(instances, eq(alertRules.instanceId, instances.id))
    .where(eq(instances.userId, userId))
    .limit(1);
  const setupAlertRule = userAlertRules.length > 0;

  const userCredentials = await db
    .select()
    .from(credentials)
    .where(eq(credentials.userId, userId))
    .limit(1);
  const storeSecret = userCredentials.length > 0;

  const onboardingProgress = parseProgress(user.onboardingProgress);
  const reviewSecurity = onboardingProgress.reviewSecurity === true;
  const inviteTeamMember = onboardingProgress.inviteTeamMember === true;

  return c.json({
    progress: {
      deployAgent,
      installSkill,
      setupAlertRule,
      storeSecret,
      reviewSecurity,
      inviteTeamMember,
    },
    completedAt: user.onboardingCompletedAt,
  });
});

// Mark onboarding step complete or dismiss
userRoutes.patch('/onboarding', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const parsed = updateOnboardingSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const body = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: 'Not found', message: 'User not found' }, 404);
  }

  if (body.dismiss) {
    await db
      .update(users)
      .set({
        onboardingCompletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, userId));

    const progress = parseProgress(user.onboardingProgress);
    return c.json({
      progress: { reviewSecurity: progress.reviewSecurity === true, inviteTeamMember: progress.inviteTeamMember === true },
      completedAt: new Date().toISOString(),
    });
  }

  if (body.step) {
    const onboardingProgress = parseProgress(user.onboardingProgress);
    onboardingProgress[body.step] = true;

    await db
      .update(users)
      .set({
        onboardingProgress: JSON.stringify(onboardingProgress),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, userId));

    return c.json({
      progress: onboardingProgress,
      completedAt: user.onboardingCompletedAt,
    });
  }

  return c.json({ error: 'Bad request', message: 'Provide step or dismiss' }, 400);
});

// Get referral info
userRoutes.get('/referral', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: 'Not found', message: 'User not found' }, 404);
  }

  let referredCount = 0;
  if (user.referralCode) {
    const result = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.referredBy, user.referralCode));
    referredCount = result[0]?.count ?? 0;
  }

  return c.json({
    referralCode: user.referralCode,
    referredCount,
    creditsEarned: user.referralCredits,
  });
});

function parseProgress(raw: string | null): Record<string, boolean> {
  if (!raw) return {};
  try { return JSON.parse(raw as string); } catch { return {}; }
}

userRoutes.route('/', alertPrefsRoutes);

export { userRoutes };
