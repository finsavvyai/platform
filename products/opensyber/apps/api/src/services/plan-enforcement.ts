import { eq, and } from 'drizzle-orm';
import { skillInstallations, skills } from '@opensyber/db';
import { PLAN_CONFIGS } from '@opensyber/shared';
import type { Plan } from '@opensyber/shared';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

type Db = DrizzleD1Database<Record<string, unknown>>;

export async function checkSkillLimit(
  db: Db,
  instanceId: string,
  plan: Plan,
): Promise<{ allowed: boolean; limit: number | null; current: number }> {
  const config = PLAN_CONFIGS[plan];
  const limit = config.verifiedSkillLimit;

  if (limit === null) {
    return { allowed: true, limit: null, current: 0 };
  }

  const installed = await db
    .select({ id: skillInstallations.id })
    .from(skillInstallations)
    .where(
      and(
        eq(skillInstallations.instanceId, instanceId),
        eq(skillInstallations.isActive, true),
      ),
    );

  return {
    allowed: installed.length < limit,
    limit,
    current: installed.length,
  };
}

export function checkUnverifiedSkillAllowed(plan: Plan): boolean {
  return PLAN_CONFIGS[plan].allowUnverifiedSkills;
}

export function getSecurityDashboardTier(plan: Plan): 'basic' | 'full' | 'full+audit' {
  return PLAN_CONFIGS[plan].securityDashboard;
}

export function getPlanFeatures(plan: Plan): {
  plan: Plan;
  instanceLimit: number;
  verifiedSkillLimit: number | null;
  allowUnverifiedSkills: boolean;
  securityDashboard: string;
  auditLogRetentionDays: number;
  supportLevel: string;
} {
  const config = PLAN_CONFIGS[plan];
  return {
    plan,
    instanceLimit: config.instanceLimit,
    verifiedSkillLimit: config.verifiedSkillLimit,
    allowUnverifiedSkills: config.allowUnverifiedSkills,
    securityDashboard: config.securityDashboard,
    auditLogRetentionDays: config.auditLogRetentionDays,
    supportLevel: config.supportLevel,
  };
}
