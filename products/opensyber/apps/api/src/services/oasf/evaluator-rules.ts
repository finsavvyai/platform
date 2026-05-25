/**
 * OASF Evaluator Rules
 *
 * Individual evaluation functions for each of the 15 OASF controls.
 * Separated from control-evaluator.ts to stay under 200 lines.
 */
import type { OasfStatus } from '@opensyber/shared';
import type { OasfEvidenceContext } from './types.js';

export type EvalFn = (ctx: OasfEvidenceContext) => {
  status: OasfStatus;
  summary: string;
  source: string;
  count: number;
};

export const evaluators: Record<string, EvalFn> = {
  /** OASF-01: All AI agent sessions are monitored and logged */
  'OASF-01': (ctx) => ({
    status: ctx.activityCount24h > 0 ? 'pass' : 'fail',
    summary: ctx.activityCount24h > 0
      ? `${ctx.activityCount24h} agent activities logged in last 24h`
      : 'No agent activity logged in last 24h',
    source: 'agent_activity',
    count: ctx.activityCount24h,
  }),

  /** OASF-02: Agents cannot access production secrets without step-up approval */
  'OASF-02': (ctx) => ({
    status: ctx.jitAccessRequestCount > 0 ? 'pass' : 'fail',
    summary: ctx.jitAccessRequestCount > 0
      ? `JIT access configured with ${ctx.jitAccessRequestCount} access requests on record`
      : 'No JIT access requests configured — step-up approval not enforced',
    source: 'jit_access_requests',
    count: ctx.jitAccessRequestCount,
  }),

  /** OASF-03: Agent activity reviewed by a human within 24 hours */
  'OASF-03': (ctx) => {
    const hasReviews = ctx.ackedViolationCount > 0;
    const hasViolations = ctx.violationCount24h > 0;
    const status: OasfStatus = hasReviews ? 'pass'
      : hasViolations ? 'fail' : 'partial';
    return {
      status,
      summary: hasReviews
        ? `${ctx.ackedViolationCount} violations reviewed and acknowledged`
        : hasViolations
          ? `${ctx.violationCount24h} violations pending human review`
          : 'No violations requiring review in last 24h',
      source: 'agent_policy_violations',
      count: ctx.ackedViolationCount,
    };
  },

  /** OASF-04: Secret detection active on all agent file operations */
  'OASF-04': (ctx) => {
    const active = ctx.secretsDetectedCount > 0 || ctx.fileAccessCount > 0;
    return {
      status: active ? 'pass' : 'fail',
      summary: active
        ? `Secret detection active; ${ctx.secretsDetectedCount} secrets found across ${ctx.fileAccessCount} file operations`
        : 'No file operations or secret detection events recorded',
      source: 'agent_activity',
      count: ctx.secretsDetectedCount,
    };
  },

  /** OASF-05: Agent sessions isolated from production environments */
  'OASF-05': (ctx) => ({
    status: ctx.sandboxPolicyCount > 0 ? 'pass' : 'fail',
    summary: ctx.sandboxPolicyCount > 0
      ? `${ctx.sandboxPolicyCount} file isolation policies enforce session sandboxing`
      : 'No sandbox/isolation policies configured',
    source: 'agent_policies',
    count: ctx.sandboxPolicyCount,
  }),

  /** OASF-06: Agent network access restricted to declared domains */
  'OASF-06': (ctx) => ({
    status: ctx.networkPolicyCount > 0 ? 'pass' : 'fail',
    summary: ctx.networkPolicyCount > 0
      ? `${ctx.networkPolicyCount} network restriction policies active`
      : 'No network access restriction policies configured',
    source: 'agent_policies',
    count: ctx.networkPolicyCount,
  }),

  /** OASF-07: Agent credentials rotated on a defined schedule */
  'OASF-07': (ctx) => ({
    status: ctx.rotationPolicyCount > 0 ? 'pass' : 'fail',
    summary: ctx.rotationPolicyCount > 0
      ? `${ctx.rotationPolicyCount} vault rotation policies active`
      : 'No credential rotation schedule configured',
    source: 'vault_rotation_policies',
    count: ctx.rotationPolicyCount,
  }),

  /** OASF-08: Supply chain dependencies scanned before agent installation */
  'OASF-08': (ctx) => ({
    status: ctx.scannedSubmissionCount > 0 ? 'pass' : 'fail',
    summary: ctx.scannedSubmissionCount > 0
      ? `${ctx.scannedSubmissionCount} skill submissions scanned for vulnerabilities`
      : 'No dependency scanning evidence found',
    source: 'marketplace_submissions',
    count: ctx.scannedSubmissionCount,
  }),

  /** OASF-09: Agent skill packages verified before execution */
  'OASF-09': (ctx) => {
    const ratio = ctx.totalSubmissionCount > 0
      ? ctx.verifiedSkillCount / ctx.totalSubmissionCount : 0;
    const status: OasfStatus = ratio >= 0.9 ? 'pass'
      : ctx.verifiedSkillCount > 0 ? 'partial' : 'fail';
    return {
      status,
      summary: `${ctx.verifiedSkillCount}/${ctx.totalSubmissionCount} skill packages verified (${Math.round(ratio * 100)}%)`,
      source: 'marketplace_submissions',
      count: ctx.verifiedSkillCount,
    };
  },

  /** OASF-10: Anomalous agent behavior triggers automated alerts */
  'OASF-10': (ctx) => ({
    status: ctx.alertRuleCount > 0 ? 'pass' : 'fail',
    summary: ctx.alertRuleCount > 0
      ? `${ctx.alertRuleCount} alert channels configured for anomaly detection`
      : 'No alert channels configured for anomaly detection',
    source: 'alert_channels',
    count: ctx.alertRuleCount,
  }),

  /** OASF-11: Agent activity audit logs retained per compliance */
  'OASF-11': (ctx) => {
    const status: OasfStatus = ctx.auditLogCount90d > 100 ? 'pass'
      : ctx.auditLogCount90d > 0 ? 'partial' : 'fail';
    return {
      status,
      summary: `${ctx.auditLogCount90d} audit log entries retained over last 90 days`,
      source: 'agent_activity',
      count: ctx.auditLogCount90d,
    };
  },

  /** OASF-12: MFA enforced for agent management */
  'OASF-12': (ctx) => ({
    status: ctx.orgMemberCount > 0 ? 'pass' : 'fail',
    summary: ctx.orgMemberCount > 0
      ? `MFA enforced via Clerk for ${ctx.orgMemberCount} active org members`
      : 'No organization members configured — MFA status unknown',
    source: 'org_members',
    count: ctx.orgMemberCount,
  }),

  /** OASF-13: RBAC limits agent provisioning */
  'OASF-13': (ctx) => ({
    status: ctx.rbacMemberCount > 1 ? 'pass'
      : ctx.rbacMemberCount === 1 ? 'partial' : 'fail',
    summary: ctx.rbacMemberCount > 0
      ? `RBAC active with ${ctx.rbacMemberCount} members assigned roles`
      : 'No RBAC configuration — agent provisioning unrestricted',
    source: 'org_members',
    count: ctx.rbacMemberCount,
  }),

  /** OASF-14: Agent blast radius assessed and documented */
  'OASF-14': (ctx) => {
    const hasSnapshots = ctx.attackPathSnapshotCount > 0;
    const hasAssets = ctx.assetCount > 0;
    const status: OasfStatus = hasSnapshots && hasAssets ? 'pass'
      : hasSnapshots || hasAssets ? 'partial' : 'fail';
    return {
      status,
      summary: `${ctx.attackPathSnapshotCount} attack path snapshots; ${ctx.assetCount} assets inventoried`,
      source: 'attack_path_snapshots',
      count: ctx.attackPathSnapshotCount,
    };
  },

  /** OASF-15: Compliance posture assessed at least quarterly */
  'OASF-15': (ctx) => ({
    status: ctx.recentAssessmentCount >= 1 ? 'pass' : 'fail',
    summary: ctx.recentAssessmentCount > 0
      ? `${ctx.recentAssessmentCount} compliance assessments completed in last 90 days`
      : 'No compliance assessments completed in last 90 days',
    source: 'oasf_assessments',
    count: ctx.recentAssessmentCount,
  }),
};
