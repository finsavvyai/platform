import type { OasfStatus } from '@opensyber/shared';

/** Evidence gathered from real system data for OASF evaluation */
export interface OasfEvidenceContext {
  /** OASF-01: agent activity records in last 24h */
  activityCount24h: number;
  /** OASF-02: JIT access requests configured */
  jitAccessRequestCount: number;
  /** OASF-03: audit log entries reviewed (acknowledged violations) */
  ackedViolationCount: number;
  /** OASF-03: total violations in last 24h */
  violationCount24h: number;
  /** OASF-04: secrets detected across agent operations */
  secretsDetectedCount: number;
  /** OASF-04: file access events (proxy for active scanning) */
  fileAccessCount: number;
  /** OASF-05: active sandbox/isolation policies */
  sandboxPolicyCount: number;
  /** OASF-06: network restriction policies */
  networkPolicyCount: number;
  /** OASF-07: vault rotation policies configured */
  rotationPolicyCount: number;
  /** OASF-08: marketplace submissions with scan results */
  scannedSubmissionCount: number;
  /** OASF-09: approved skill submissions */
  verifiedSkillCount: number;
  /** OASF-09: total skill submissions */
  totalSubmissionCount: number;
  /** OASF-10: active alert rules for anomaly detection */
  alertRuleCount: number;
  /** OASF-11: audit log entries in last 90 days */
  auditLogCount90d: number;
  /** OASF-12: org member count (MFA via Clerk) */
  orgMemberCount: number;
  /** OASF-13: org members with roles assigned */
  rbacMemberCount: number;
  /** OASF-14: attack path snapshots */
  attackPathSnapshotCount: number;
  /** OASF-14: assets inventoried */
  assetCount: number;
  /** OASF-15: OASF assessments in last 90 days */
  recentAssessmentCount: number;
}

export interface ControlEvaluation {
  controlId: string;
  status: OasfStatus;
  evidenceSummary: string;
  evidenceDetails: string | null;
  sourceTable: string;
  recordCount: number;
}

export interface AssessmentResult {
  assessmentId: string;
  overallScore: number;
  grade: string;
  passingCount: number;
  failingCount: number;
  partialCount: number;
  totalControls: number;
  controls: ControlEvaluation[];
}
