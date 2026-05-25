/**
 * DLP Scan Request, Result, Violation, and Action Result Types
 */

import type {
  RiskLevel,
  ViolationSeverity,
  DLPActionType,
  ScanDataInput,
  DataClassification,
} from "./core-types";
import type { DLPAction } from "./rules-policies";

// DLP Scan Request
export interface DLPScanRequest {
  id?: string;
  data: ScanDataInput;
  userId: string;
  dataSource: string;
  context?: {
    roles?: string[];
    department?: string;
    location?: string;
    device?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
  options?: {
    deepScan?: boolean;
    batchSize?: number;
    timeout?: number;
    retryCount?: number;
  };
}

// DLP Violation
export interface DLPViolation {
  ruleId: string;
  ruleName: string;
  severity: ViolationSeverity;
  description: string;
  detectedAt: string;
  evidence: {
    type: string;
    pattern?: string;
    matches: string[];
    location?: {
      line?: number;
      column?: number;
      offset?: number;
    };
    context?: string;
  };
  riskScore: number;
  remediation?: string;
  falsePositive?: boolean;
}

// DLP Action Result
export interface DLPActionResult {
  actionId: string;
  type: DLPActionType;
  status: "success" | "error" | "skipped" | "pending";
  result?: {
    processedData?: unknown;
    encrypted?: boolean;
    masked?: boolean;
    blocked?: boolean;
    quarantined?: boolean;
    alerted?: boolean;
    custom?: unknown;
  };
  error?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// DLP Scan Result
export interface DLPScanResult {
  scanId: string;
  timestamp: string;
  userId: string;
  dataSource: string;
  classification: DataClassification;
  riskLevel: RiskLevel;
  violations: DLPViolation[];
  actions: DLPAction[];
  actionResults: DLPActionResult[];
  metrics: {
    scanDuration: number;
    dataItemsProcessed: number;
    rulesEvaluated: number;
    policiesApplied: number;
    bytesProcessed: number;
    cacheHits: number;
    cacheMisses: number;
  };
  recommendations: string[];
  error?: string;
}

// Alert params for sendAlert
export interface DLPAlertParams {
  severity?: ViolationSeverity | string;
  message?: string;
  recipients?: string[];
  metadata?: Record<string, unknown>;
}

// Masking params
export interface MaskingParams {
  method?: string;
  preserveFormat?: boolean;
  visibleChars?: number;
}

// Encryption params
export interface EncryptionParams {
  algorithm?: string;
  keyId?: string;
  keyRotation?: boolean;
}

// Encrypted data result
export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  algorithm: string;
  keyId: string;
  timestamp: string;
}

// Quarantine action params
export interface QuarantineParams {
  reason?: string;
  retentionDays?: number;
}

// Top violation entry
export interface TopViolationEntry {
  ruleId: string;
  count: number;
}
