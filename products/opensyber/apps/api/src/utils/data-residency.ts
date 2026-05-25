import { eq } from 'drizzle-orm';
import { dataResidencyConfigs } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

type Db = DrizzleD1Database<Record<string, unknown>>;

const REGION_MAP: Record<string, string[]> = {
  eu: ['eu-central'],
  us: ['us-east', 'us-west'],
  ap: ['ap-southeast'],
};

export async function enforceResidency(
  db: Db,
  orgId: string | null,
  requestedRegion: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!orgId) return { allowed: true };

  const [config] = await db
    .select()
    .from(dataResidencyConfigs)
    .where(eq(dataResidencyConfigs.orgId, orgId));

  if (!config) return { allowed: true };

  const allowedRegions = REGION_MAP[config.region];
  if (!allowedRegions) return { allowed: true };

  if (!allowedRegions.includes(requestedRegion)) {
    return {
      allowed: false,
      reason: `Data residency policy requires region "${config.region}". Allowed compute regions: ${allowedRegions.join(', ')}`,
    };
  }

  return { allowed: true };
}

export { REGION_MAP };
