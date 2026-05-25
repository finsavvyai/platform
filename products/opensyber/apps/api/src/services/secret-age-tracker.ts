/**
 * Secret Age Tracker
 *
 * Checks all vault rotation policies against their rotation interval
 * and returns secrets that are overdue for rotation, along with age metrics.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { vaultRotationPolicies } from '@opensyber/db';

type Db = DrizzleD1Database<Record<string, unknown>>;

const MS_PER_DAY = 86_400_000;

export interface SecretAgeInfo {
  policyId: string;
  secretPattern: string;
  rotationIntervalDays: number;
  lastRotatedAt: string | null;
  ageDays: number;
  isOverdue: boolean;
  daysOverdue: number;
  nextRotationAt: string | null;
  urgency: 'critical' | 'warning' | 'ok';
}

export interface AgingSummary {
  totalPolicies: number;
  overdueCount: number;
  criticalCount: number;
  warningCount: number;
  secrets: SecretAgeInfo[];
}

/**
 * Calculate the age category urgency based on how overdue a secret is.
 * - critical: more than 2x the rotation interval without rotation
 * - warning: overdue (past interval)
 * - ok: within rotation interval
 */
function getUrgency(ageDays: number, intervalDays: number): 'critical' | 'warning' | 'ok' {
  if (ageDays >= intervalDays * 2) return 'critical';
  if (ageDays >= intervalDays) return 'warning';
  return 'ok';
}

/**
 * Get all vault secrets with age information and overdue status.
 * Only evaluates active rotation policies for the given org.
 */
export async function getSecretAging(db: Db, orgId: string): Promise<AgingSummary> {
  const policies = await db.select().from(vaultRotationPolicies)
    .where(eq(vaultRotationPolicies.orgId, orgId));

  const now = Date.now();
  const secrets: SecretAgeInfo[] = [];

  for (const policy of policies) {
    if (policy.status !== 'active') continue;

    const lastRotated = policy.lastRotatedAt ? new Date(policy.lastRotatedAt).getTime() : null;
    const createdAt = new Date(policy.createdAt).getTime();
    const referenceTime = lastRotated ?? createdAt;
    const ageDays = Math.floor((now - referenceTime) / MS_PER_DAY);
    const isOverdue = ageDays >= policy.rotationIntervalDays;
    const daysOverdue = isOverdue ? ageDays - policy.rotationIntervalDays : 0;

    secrets.push({
      policyId: policy.id,
      secretPattern: policy.secretPattern,
      rotationIntervalDays: policy.rotationIntervalDays,
      lastRotatedAt: policy.lastRotatedAt,
      ageDays,
      isOverdue,
      daysOverdue,
      nextRotationAt: policy.nextRotationAt,
      urgency: getUrgency(ageDays, policy.rotationIntervalDays),
    });
  }

  // Sort overdue secrets first, then by urgency
  secrets.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return b.daysOverdue - a.daysOverdue;
  });

  return {
    totalPolicies: secrets.length,
    overdueCount: secrets.filter((s) => s.isOverdue).length,
    criticalCount: secrets.filter((s) => s.urgency === 'critical').length,
    warningCount: secrets.filter((s) => s.urgency === 'warning').length,
    secrets,
  };
}

/**
 * Get only overdue secrets — convenience function for alert pipelines.
 */
export async function getOverdueSecrets(db: Db, orgId: string): Promise<SecretAgeInfo[]> {
  const summary = await getSecretAging(db, orgId);
  return summary.secrets.filter((s) => s.isOverdue);
}
