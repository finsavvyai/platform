/**
 * Skill Recommendation Engine
 *
 * Suggests skills based on user context, like VS Code extension
 * recommendations. Analyzes connected integrations, cloud accounts,
 * alert channels, and installed skills to find coverage gaps.
 */

import { eq, and } from 'drizzle-orm';
import {
  skillInstallations, integrationConnections,
  cloudAccounts, alertChannels,
} from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { SIGNAL_RULES } from './skill-recommendation-rules';
import type { ResolvedContext } from './skill-recommendation-rules';

export interface SkillRecommendation {
  skillSlug: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  signal: string;
}

interface UserContext {
  userId: string;
  orgId: string | null;
  instanceIds: string[];
}

/**
 * Generate skill recommendations for a user based on their context.
 */
export async function getRecommendations(
  db: DrizzleD1Database<any>,
  ctx: UserContext,
): Promise<SkillRecommendation[]> {
  const resolved = await resolveContext(db, ctx);

  return SIGNAL_RULES
    .filter((rule) => rule.check(resolved))
    .map(({ slug, reason, priority, signal }) => ({
      skillSlug: slug,
      reason,
      priority,
      signal,
    }))
    .slice(0, 5); // Max 5 recommendations
}

async function resolveContext(
  db: DrizzleD1Database<any>,
  ctx: UserContext,
): Promise<ResolvedContext> {
  const [installations, connections, clouds, channels] = await Promise.all([
    getInstalledSlugs(db, ctx.instanceIds),
    getIntegrations(db, ctx.instanceIds),
    getCloudAccountCount(db, ctx.userId),
    getAlertChannels(db, ctx.orgId),
  ]);

  return {
    installedSlugs: installations,
    hasCloudAccounts: clouds > 0,
    hasSlackChannel: channels.has('slack'),
    hasPagerDutyChannel: channels.has('pagerduty'),
    hasGitHubIntegration: connections.has('github'),
  };
}

async function getInstalledSlugs(db: DrizzleD1Database<any>, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  try {
    const rows = await db.select({ skillId: skillInstallations.skillId })
      .from(skillInstallations).where(eq(skillInstallations.isActive, true));
    return new Set(rows.map((r) => r.skillId));
  } catch { return new Set(); }
}

async function getIntegrations(db: DrizzleD1Database<any>, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  try {
    const rows = await db.select({ slug: integrationConnections.integrationSlug })
      .from(integrationConnections).where(eq(integrationConnections.status, 'connected'));
    return new Set(rows.map((r) => r.slug));
  } catch { return new Set(); }
}

async function getCloudAccountCount(db: DrizzleD1Database<any>, userId: string): Promise<number> {
  try {
    const rows = await db.select({ id: cloudAccounts.id }).from(cloudAccounts)
      .where(and(eq(cloudAccounts.userId, userId), eq(cloudAccounts.status, 'active')));
    return rows.length;
  } catch { return 0; }
}

async function getAlertChannels(db: DrizzleD1Database<any>, orgId: string | null): Promise<Set<string>> {
  if (!orgId) return new Set();
  try {
    const rows = await db.select({ type: alertChannels.channelType }).from(alertChannels)
      .where(and(eq(alertChannels.orgId, orgId), eq(alertChannels.isActive, true)));
    return new Set(rows.map((r) => r.type));
  } catch { return new Set(); }
}
