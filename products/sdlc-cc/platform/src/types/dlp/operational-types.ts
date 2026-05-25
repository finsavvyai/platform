/**
 * DLP Operational Types - Audit, Quarantine, Stats, Reports
 */

import type {
  RiskLevel, ViolationSeverity, DataType, DLPActionType, DataClassification,
} from "./core-types";
import type { DLPViolation } from "./scan-results";

export interface AuditLog {
  id: string;
  timestamp: string;
  type: "SCAN" | "RULE_CHANGE" | "POLICY_CHANGE" | "QUARANTINE" | "ALERT" | "CUSTOM_ACTION";
  userId: string;
  action?: string;
  dataSource?: string;
  riskLevel?: RiskLevel;
  classification?: DataClassification;
  violations?: number;
  actions?: number;
  duration?: number;
  ruleId?: string;
  policyId?: string;
  metadata: Record<string, unknown>;
}

export interface QuarantineRecord {
  id: string;
  scanId?: string;
  timestamp: string;
  userId: string;
  dataSource?: string;
  data?: unknown;
  dataHash?: string;
  riskLevel: RiskLevel;
  classification: DataClassification;
  violations: DLPViolation[];
  status: "QUARANTINED" | "RELEASED" | "DELETED" | "EXPIRED";
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

export interface DLPStats {
  period: { start: string; end: string };
  scans: {
    total: number; successful: number; failed: number;
    averageDuration: number; dataProcessed: number;
  };
  violations: {
    total: number;
    bySeverity: Record<ViolationSeverity, number>;
    byRule: Record<string, number>;
    byDataType: Record<DataType, number>;
    falsePositiveRate: number;
  };
  risk: {
    distribution: Record<RiskLevel, number>;
    highRiskEvents: number;
    criticalRiskEvents: number;
  };
  actions: {
    applied: number;
    byType: Record<DLPActionType, number>;
    successRate: number;
  };
  quarantine: { active: number; released: number; deleted: number; expired: number };
  performance: {
    throughput: number;
    latency: { p50: number; p95: number; p99: number };
    errorRate: number;
    cacheHitRate: number;
  };
}

export interface DLPReport {
  id: string;
  type: "COMPLIANCE" | "INCIDENT" | "TREND" | "SUMMARY";
  period: { start: string; end: string };
  generatedAt: string;
  generatedBy: string;
  summary: {
    totalScans: number;
    totalViolations: number;
    riskDistribution: Record<RiskLevel, number>;
    complianceStatus: Record<string, string>;
  };
  details: {
    topViolations: Array<{ ruleId: string; count: number; severity: ViolationSeverity }>;
    dataTypes: Array<{ type: DataType; count: number; riskLevel: RiskLevel }>;
    users: Array<{ userId: string; violationCount: number; riskLevel: RiskLevel }>;
    recommendations: string[];
  };
  attachments?: string[];
}
