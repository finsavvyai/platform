/**
 * DLP Integration, Event, ML, Workflow, and API Response Types
 */

import type { DLPCondition, DLPRule, DLPPolicy } from "./rules-policies";
import type { DLPViolation } from "./scan-results";
import type { DLPStats, QuarantineRecord } from "./config-stats";

// DLP Event
export interface DLPEvent {
  id: string;
  type:
    | "SCAN_STARTED" | "SCAN_COMPLETED" | "VIOLATION_DETECTED"
    | "CRITICAL_RISK" | "RULE_ADDED" | "POLICY_UPDATED";
  timestamp: string;
  source: string;
  userId?: string;
  data: Record<string, unknown>;
  severity: "INFO" | "WARN" | "ERROR" | "CRITICAL";
}

// ML Model Configuration
export interface MLModelConfig {
  id: string;
  name: string;
  version: string;
  type: "CLASSIFICATION" | "ANOMALY_DETECTION" | "SEQUENCE_DETECTION";
  inputFormat: string;
  outputFormat: string;
  confidenceThreshold: number;
  modelPath: string;
  parameters: Record<string, unknown>;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    latency: number;
  };
}

// DLP Workflow
export interface DLPWorkflow {
  id: string;
  name: string;
  description: string;
  steps: DLPWorkflowStep[];
  triggers: DLPWorkflowTrigger[];
  enabled: boolean;
  metadata: {
    version: number;
    createdAt: string;
    updatedAt: string;
    owner: string;
  };
}

// DLP Workflow Step
export interface DLPWorkflowStep {
  id: string;
  name: string;
  type:
    | "SCAN" | "CLASSIFY" | "APPLY_POLICY"
    | "NOTIFY" | "QUARANTINE" | "CUSTOM";
  order: number;
  config: Record<string, unknown>;
  conditions?: DLPCondition[];
  onStepError: "CONTINUE" | "STOP" | "RETRY";
  retryConfig?: {
    maxRetries: number;
    delay: number;
  };
}

// DLP Workflow Trigger
export interface DLPWorkflowTrigger {
  type: "DATA_INGESTION" | "SCHEDULE" | "MANUAL" | "EVENT";
  config: Record<string, unknown>;
  enabled: boolean;
}

// Integration Interfaces
export interface DLPIntegration {
  type: "SIEM" | "CASB" | "DAM" | "IAM" | "CUSTOM";
  config: {
    endpoint: string;
    credentials: {
      apiKey?: string;
      username?: string;
      password?: string;
      certificate?: string;
    };
    mapping: Record<string, string>;
    format: "JSON" | "XML" | "CEF" | "LEEF";
  };
  enabled: boolean;
  lastSync?: string;
}

// API Response Types
export interface DLPScanResponse {
  success: boolean;
  scanId: string;
  result?: import("./scan-results").DLPScanResult;
  error?: string;
  requestId: string;
  timestamp: string;
}

export interface DLPStatsResponse {
  success: boolean;
  stats: DLPStats;
  period: { start: string; end: string };
  requestId: string;
  timestamp: string;
}

export interface DLPRulesResponse {
  success: boolean;
  rules: DLPRule[];
  total: number;
  page: number;
  pageSize: number;
  requestId: string;
  timestamp: string;
}

export interface DLPPoliciesResponse {
  success: boolean;
  policies: DLPPolicy[];
  total: number;
  page: number;
  pageSize: number;
  requestId: string;
  timestamp: string;
}

// WebSocket Event Types
export type DLPWebSocketEvent =
  | {
      type: "SCAN_PROGRESS";
      data: { scanId: string; progress: number; status: string };
    }
  | { type: "VIOLATION_ALERT"; data: DLPViolation }
  | { type: "QUARANTINE_ALERT"; data: QuarantineRecord }
  | {
      type: "SYSTEM_STATUS";
      data: { status: string; metrics: Record<string, unknown> };
    }
  | { type: "RULE_UPDATED"; data: DLPRule }
  | { type: "POLICY_UPDATED"; data: DLPPolicy };
