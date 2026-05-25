/**
 * Secret Rotation Policy Evaluator
 *
 * Evaluates rotation policies against secret age and generates
 * alerts for overdue rotations.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, lt } from 'drizzle-orm';
import { vaultRotationPolicies } from '@opensyber/db';

type Db = DrizzleD1Database<Record<string, unknown>>;

export interface RotationStatus {
  id: string;
  secretPattern: string;
  intervalDays: number;
  lastRotated: string | null;
  nextRotation: string | null;
  isOverdue: boolean;
  daysOverdue: number;
}

export async function evaluateRotationPolicies(db: Db, orgId: string): Promise<RotationStatus[]> {
  const policies = await db.select().from(vaultRotationPolicies)
    .where(and(eq(vaultRotationPolicies.orgId, orgId), eq(vaultRotationPolicies.status, 'active')));

  const now = new Date();
  return policies.map((policy) => {
    const nextRotation = policy.nextRotationAt ? new Date(policy.nextRotationAt) : null;
    const isOverdue = nextRotation ? nextRotation < now : false;
    const daysOverdue = isOverdue && nextRotation
      ? Math.floor((now.getTime() - nextRotation.getTime()) / 86400000)
      : 0;

    return {
      id: policy.id,
      secretPattern: policy.secretPattern,
      intervalDays: policy.rotationIntervalDays,
      lastRotated: policy.lastRotatedAt,
      nextRotation: policy.nextRotationAt,
      isOverdue,
      daysOverdue,
    };
  });
}

export function calculateNextRotation(lastRotated: string, intervalDays: number): string {
  const date = new Date(lastRotated);
  date.setDate(date.getDate() + intervalDays);
  return date.toISOString();
}
