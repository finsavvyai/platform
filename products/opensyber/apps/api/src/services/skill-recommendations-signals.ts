/**
 * User signal collection for vector-based skill recommendations.
 *
 * Extracted from skill-recommendations-vector.ts to stay within the
 * 200-line file cap. Pure data-loading helpers with graceful fallback.
 */

import { eq, and, inArray } from 'drizzle-orm';
import {
  skills,
  skillInstallations,
  integrationConnections,
  cloudAccounts,
  alertChannels,
} from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

type Db = DrizzleD1Database<Record<string, unknown>>;

export interface UserSignals {
  installedSkillIds: Set<string>;
  integrationSlugs: string[];
  hasCloudAccounts: boolean;
  alertChannelTypes: string[];
}

export interface SignalContext {
  userId: string;
  orgId: string | null;
  instanceIds: string[];
}

/** Collect all signals for a user in parallel. */
export async function collectUserSignals(
  db: Db,
  ctx: SignalContext,
): Promise<UserSignals> {
  const [installedSkillIds, integrationSlugs, cloudCount, channelTypes] =
    await Promise.all([
      loadInstalledSkillIds(db, ctx.instanceIds),
      loadIntegrationSlugs(db, ctx.instanceIds),
      loadCloudAccountCount(db, ctx.userId),
      loadAlertChannelTypes(db, ctx.orgId),
    ]);

  return {
    installedSkillIds,
    integrationSlugs,
    hasCloudAccounts: cloudCount > 0,
    alertChannelTypes: channelTypes,
  };
}

async function loadInstalledSkillIds(
  db: Db,
  instanceIds: string[],
): Promise<Set<string>> {
  if (instanceIds.length === 0) return new Set();
  try {
    const rows = await db
      .select({ skillId: skillInstallations.skillId })
      .from(skillInstallations)
      .where(eq(skillInstallations.isActive, true));
    return new Set(rows.map((r) => r.skillId));
  } catch {
    return new Set();
  }
}

async function loadIntegrationSlugs(
  db: Db,
  instanceIds: string[],
): Promise<string[]> {
  if (instanceIds.length === 0) return [];
  try {
    const rows = await db
      .select({ slug: integrationConnections.integrationSlug })
      .from(integrationConnections)
      .where(eq(integrationConnections.status, 'connected'));
    return Array.from(new Set(rows.map((r) => r.slug)));
  } catch {
    return [];
  }
}

async function loadCloudAccountCount(
  db: Db,
  userId: string,
): Promise<number> {
  try {
    const rows = await db
      .select({ id: cloudAccounts.id })
      .from(cloudAccounts)
      .where(
        and(eq(cloudAccounts.userId, userId), eq(cloudAccounts.status, 'active')),
      );
    return rows.length;
  } catch {
    return 0;
  }
}

async function loadAlertChannelTypes(
  db: Db,
  orgId: string | null,
): Promise<string[]> {
  if (!orgId) return [];
  try {
    const rows = await db
      .select({ type: alertChannels.channelType })
      .from(alertChannels)
      .where(
        and(eq(alertChannels.orgId, orgId), eq(alertChannels.isActive, true)),
      );
    return Array.from(new Set(rows.map((r) => r.type)));
  } catch {
    return [];
  }
}

/** Look up skill slugs by their IDs, returning a Map keyed by id. */
export async function loadSlugsByIds(
  db: Db,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  try {
    const rows = await db
      .select({ id: skills.id, slug: skills.slug })
      .from(skills)
      .where(inArray(skills.id, ids));
    return new Map(rows.map((r) => [r.id, r.slug]));
  } catch {
    return new Map();
  }
}
