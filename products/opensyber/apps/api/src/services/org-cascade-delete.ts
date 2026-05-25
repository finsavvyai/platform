import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  organizations,
  orgMembers,
  orgInvitations,
  instances,
  ssoConfigs,
  customRoles,
  agentPolicies,
  agentPolicyViolations,
} from '@opensyber/db';

type Db = DrizzleD1Database<Record<string, unknown>>;

/**
 * Delete all records related to an organization before removing the org itself.
 * Cloudflare D1 does not reliably enforce ON DELETE CASCADE, so we perform
 * explicit cleanup in the correct dependency order.
 *
 * @param db - Drizzle D1 database instance
 * @param orgId - Organization ID to cascade-delete
 */
export async function cascadeDeleteOrg(db: Db, orgId: string): Promise<void> {
  // Phase 1: delete child-of-child records (policy violations depend on policies)
  await db.delete(agentPolicyViolations).where(eq(agentPolicyViolations.orgId, orgId));

  // Phase 2: delete direct children in parallel-safe batch
  await db.batch([
    db.delete(agentPolicies).where(eq(agentPolicies.orgId, orgId)),
    db.delete(ssoConfigs).where(eq(ssoConfigs.orgId, orgId)),
    db.delete(customRoles).where(eq(customRoles.orgId, orgId)),
    db.delete(orgInvitations).where(eq(orgInvitations.orgId, orgId)),
    db.delete(orgMembers).where(eq(orgMembers.orgId, orgId)),
  ]);

  // Phase 3: nullify org reference on instances (they may still be running)
  await db
    .update(instances)
    .set({ orgId: null })
    .where(eq(instances.orgId, orgId));

  // Phase 4: delete the organization itself
  await db.delete(organizations).where(eq(organizations.id, orgId));
}
