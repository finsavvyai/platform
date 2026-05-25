import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { users, organizations } from '@opensyber/db';
import { PLAN_CONFIGS, higherPlan } from '@opensyber/shared';
import type { Plan, PlanConfig } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';

type AppEnv = { Bindings: Env; Variables: Variables };

export interface PlanContext {
  plan: Plan;
  config: PlanConfig;
  isOrg: boolean;
}

/**
 * Loads the user's or org's plan configuration and caches it in the context.
 * MUST run after authMiddleware (requires userId).
 *
 * For org-scoped requests (X-Org-Id header present), uses the org's plan.
 * Otherwise, uses the user's personal plan.
 */
export const loadPlanConfig = createMiddleware<AppEnv>(async (c, next) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? c.req.header('X-Org-Id') ?? null;
  const db = c.get('db');

  let plan: Plan;
  let isOrg = false;

  if (orgId) {
    // Org context — use the higher of org plan and user's personal plan.
    // Handles the case where subscription upgrade updated users.plan but
    // organizations.plan wasn't synced (e.g. LemonSqueezy webhook → users table).
    const [org] = await db
      .select({ plan: organizations.plan })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) {
      return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);
    }

    const [user] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const orgPlan = org.plan as Plan;
    const userPlan = (user?.plan as Plan) ?? 'free';
    plan = higherPlan(orgPlan, userPlan);
    isOrg = true;
  } else {
    // Solo context — use user's plan
    const [user] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: 'Not Found', message: 'User not found' }, 404);
    }

    plan = user.plan as Plan;
    isOrg = false;
  }

  const config = PLAN_CONFIGS[plan];

  // Cache for downstream middleware/routes
  c.set('planConfig', { plan, config, isOrg });

  await next();
});

/** Human-readable names for plan features. */
const FEATURE_DISPLAY_NAMES: Partial<Record<keyof PlanConfig, string>> = {
  cloudSync: 'Cloud Security Scanning',
  teamDashboard: 'Team Dashboard',
  policyEngine: 'Alert Channels & Policies',
  pdfReports: 'PDF Reports',
};

/** Minimum plan required per feature. */
const FEATURE_MIN_PLAN: Partial<Record<keyof PlanConfig, string>> = {
  cloudSync: 'Pro',
  teamDashboard: 'Team',
  policyEngine: 'Pro',
  pdfReports: 'Pro',
};

/**
 * Checks if the current plan has access to a specific feature.
 * Returns 403 with upgrade details if feature is not available.
 *
 * Usage: `requirePlanFeature('cloudSync')`
 *
 * Features match PlanConfig keys:
 * - cloudSync, teamDashboard, policyEngine, pdfReports
 */
export function requirePlanFeature(feature: keyof PlanConfig) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const planContext = c.get('planConfig') as PlanContext | undefined;

    if (!planContext) {
      return c.json(
        { error: 'Internal Error', message: 'Plan config not loaded. Run loadPlanConfig first.' },
        500,
      );
    }

    const { plan, config } = planContext;
    const hasFeature = config[feature];

    if (!hasFeature) {
      const displayName = FEATURE_DISPLAY_NAMES[feature] ?? String(feature);
      const minPlan = FEATURE_MIN_PLAN[feature] ?? 'a higher';
      return c.json(
        {
          error: 'Forbidden',
          message: `${displayName} requires a ${minPlan} plan or higher. Upgrade to unlock this feature.`,
          upgradeRequired: true,
          currentPlan: plan,
          feature,
        },
        403,
      );
    }

    await next();
  });
}

/**
 * Checks if the current plan has not exceeded a specific limit.
 * Returns 403 with upgrade details if limit is reached or exceeded.
 *
 * Usage: `requirePlanLimit('cspmAccounts', 5)`
 *
 * Limit keys match PlanConfig keys (agentLimit, cspmAccounts, etc.)
 */
export function requirePlanLimit(
  limitKey: keyof PlanConfig,
  currentCount: number,
) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const planContext = c.get('planConfig') as PlanContext | undefined;

    if (!planContext) {
      return c.json(
        { error: 'Internal Error', message: 'Plan config not loaded. Run loadPlanConfig first.' },
        500,
      );
    }

    const { plan, config } = planContext;
    const limit = config[limitKey] as number;

    if (typeof limit !== 'number') {
      return c.json(
        { error: 'Internal Error', message: `Invalid limit key: ${String(limitKey)}` },
        500,
      );
    }

    if (currentCount >= limit) {
      return c.json(
        {
          error: 'Forbidden',
          message: `You have reached the limit for ${String(limitKey)} on your current plan.`,
          upgradeRequired: true,
          currentPlan: plan,
          limitKey,
          current: currentCount,
          limit,
        },
        403,
      );
    }

    await next();
  });
}
