/**
 * OASF Evidence Collector
 *
 * Queries real database tables to build the evidence context
 * used by the control evaluator. No mock data.
 */
import { eq, gte, and, sql, inArray } from 'drizzle-orm';
import {
  agentActivity, agentPolicies, agentPolicyViolations,
  alertChannels, attackPathSnapshots,
  assets, orgMembers, oasfAssessments,
  marketplaceSubmissions, vaultRotationPolicies,
  jitAccessRequests,
} from '@opensyber/db';
import type { OasfEvidenceContext } from './types.js';

export async function collectEvidence(
  db: any, orgId: string,
): Promise<OasfEvidenceContext> {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    activity24h, jitRequests,
    ackedViolations, violations24h,
    secretsDetected, fileAccess,
    sandboxPolicies, networkPolicies,
    rotationPolicies, scannedSubs,
    verifiedSkills, totalSubs,
    alertRules, auditLogs90d,
    members, rbacMembers,
    attackSnapshots, assetTotal,
    recentAssessments,
  ] = await Promise.all([
    countWhere(db, agentActivity, and(eq(agentActivity.orgId, orgId), gte(agentActivity.createdAt, h24))),
    countWhere(db, jitAccessRequests, eq(jitAccessRequests.orgId, orgId)),
    countWhere(db, agentPolicyViolations, and(eq(agentPolicyViolations.orgId, orgId), eq(agentPolicyViolations.acknowledged, true))),
    countWhere(db, agentPolicyViolations, and(eq(agentPolicyViolations.orgId, orgId), gte(agentPolicyViolations.createdAt, h24))),
    sumSecretsCount(db, orgId),
    countWhere(db, agentActivity, and(eq(agentActivity.orgId, orgId), eq(agentActivity.type, 'file_read'))),
    countWhere(db, agentPolicies, and(eq(agentPolicies.orgId, orgId), eq(agentPolicies.isActive, true), eq(agentPolicies.ruleType, 'file_pattern'))),
    countWhere(db, agentPolicies, and(eq(agentPolicies.orgId, orgId), eq(agentPolicies.isActive, true), eq(agentPolicies.ruleType, 'command_pattern'))),
    countWhere(db, vaultRotationPolicies, and(eq(vaultRotationPolicies.orgId, orgId), eq(vaultRotationPolicies.status, 'active'))),
    countSubmissionsByStatus(db, ['scanning', 'reviewing', 'approved', 'rejected']),
    countSubmissionsByStatus(db, ['approved']),
    countAllSubmissions(db),
    countActiveAlertRules(db, orgId),
    countAuditLogs(db, orgId, d90),
    countWhere(db, orgMembers, and(eq(orgMembers.orgId, orgId), eq(orgMembers.status, 'active'))),
    countWhere(db, orgMembers, and(eq(orgMembers.orgId, orgId), eq(orgMembers.status, 'active'))),
    countWhere(db, attackPathSnapshots, eq(attackPathSnapshots.orgId, orgId)),
    countWhere(db, assets, eq(assets.orgId, orgId)),
    countWhere(db, oasfAssessments, and(eq(oasfAssessments.orgId, orgId), gte(oasfAssessments.createdAt, d90))),
  ]);

  return {
    activityCount24h: activity24h,
    jitAccessRequestCount: jitRequests,
    ackedViolationCount: ackedViolations,
    violationCount24h: violations24h,
    secretsDetectedCount: secretsDetected,
    fileAccessCount: fileAccess,
    sandboxPolicyCount: sandboxPolicies,
    networkPolicyCount: networkPolicies,
    rotationPolicyCount: rotationPolicies,
    scannedSubmissionCount: scannedSubs,
    verifiedSkillCount: verifiedSkills,
    totalSubmissionCount: totalSubs,
    alertRuleCount: alertRules,
    auditLogCount90d: auditLogs90d,
    orgMemberCount: members,
    rbacMemberCount: rbacMembers,
    attackPathSnapshotCount: attackSnapshots,
    assetCount: assetTotal,
    recentAssessmentCount: recentAssessments,
  };
}

async function countWhere(db: any, table: any, condition: any): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(table).where(condition);
  return rows[0]?.count ?? 0;
}

async function sumSecretsCount(db: any, orgId: string): Promise<number> {
  const rows = await db.select({ total: sql<number>`coalesce(sum(secrets_count), 0)` })
    .from(agentActivity).where(eq(agentActivity.orgId, orgId));
  return rows[0]?.total ?? 0;
}

async function countSubmissionsByStatus(db: any, statuses: string[]): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` })
    .from(marketplaceSubmissions)
    .where(inArray(marketplaceSubmissions.status, statuses as typeof marketplaceSubmissions.status.enumValues));
  return rows[0]?.count ?? 0;
}

async function countAllSubmissions(db: any): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceSubmissions);
  return rows[0]?.count ?? 0;
}

async function countActiveAlertRules(db: any, orgId: string): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` })
    .from(alertChannels)
    .where(and(eq(alertChannels.orgId, orgId), eq(alertChannels.isActive, true)));
  return rows[0]?.count ?? 0;
}

async function countAuditLogs(db: any, orgId: string, since: string): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` })
    .from(agentActivity)
    .where(and(eq(agentActivity.orgId, orgId), gte(agentActivity.createdAt, since)));
  return rows[0]?.count ?? 0;
}
