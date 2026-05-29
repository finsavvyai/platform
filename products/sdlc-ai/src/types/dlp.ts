/**
 * DLP (Data Loss Prevention) Type Definitions
 * Defines comprehensive types for data classification, protection, and monitoring
 */

// Core Data Types
export type DataType =
  | "PII" // Personally Identifiable Information
  | "PHI" // Protected Health Information
  | "FINANCIAL" // Financial Information
  | "CONFIDENTIAL" // Business Confidential
  | "INTERNAL" // Internal Use Only
  | "PUBLIC" // Public Information
  | "UNKNOWN"; // Unknown Classification

// Risk Levels
export type RiskLevel =
  | "NONE"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL"
  | "ERROR";

// Violation Severity
export type ViolationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// Masking Methods
export type MaskingMethod =
  | "FULL" // Complete masking
  | "PARTIAL" // Partial masking (show first/last N chars)
  | "TOKENIZATION" // Replace with tokens
  | "HASH" // One-way hash
  | "NULLIFY" // Replace with null/empty
  | "NOISE" // Add random noise to numerical values
  | "GENERALIZE" // Generalize values (e.g., age ranges)
  | "SUPPRESSION"; // Remove entire field

// Encryption Algorithms
export type EncryptionAlgorithm =
  | "AES-128-GCM"
  | "AES-256-GCM"
  | "AES-256-CBC"
  | "RSA-2048"
  | "RSA-4096"
  | "CHACHA20-POLY1305";

// DLP Scan Request
export interface DLPScanRequest {
  id?: string;
  data: any;
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

// Data Classification Result
export interface DataClassification {
  type: DataType;
  confidence: number; // 0-1
  tags: string[];
  metadata: {
    detectedPatterns?: string[];
    mlPredictions?: Record<string, number>;
    keywords?: string[];
    entropy?: number;
    language?: string;
    encoding?: string;
  };
  subTypes?: string[];
  sensitivityScore?: number; // 0-100
  retentionPeriod?: number; // days
  complianceFrameworks?: ComplianceFramework[];
}

// Compliance Frameworks
export interface ComplianceFramework {
  name: string;
  version: string;
  requirements: string[];
  status: "COMPLIANT" | "NON_COMPLIANT" | "PARTIALLY_COMPLIANT";
  lastAssessed: string;
}

// DLP Rule Definition
export interface DLPRule {
  id: string;
  name: string;
  description: string;
  severity: ViolationSeverity;
  enabled: boolean;
  priority: number; // 1-10, higher = more priority
  conditions: DLPCondition[];
  dataTypes?: DataType[];
  tags?: string[];
  actions: string[]; // Action identifiers
  exceptions?: DLPException[];
  metadata: {
    category: string;
    author: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    lastTriggered?: string;
    triggerCount: number;
    falsePositiveRate: number;
  };
}

// DLP Condition Types
export interface DLPCondition {
  id: string;
  type: "REGEX" | "KEYWORD" | "ML_MODEL" | "ENTROPY" | "FORMAT" | "CUSTOM";
  operator:
    | "MATCHES"
    | "CONTAINS"
    | "EQUALS"
    | "GREATER_THAN"
    | "LESS_THAN"
    | "NOT_EQUAL";
  value: any;
  parameters?: {
    flags?: string; // For regex
    threshold?: number; // For entropy
    modelId?: string; // For ML models
    caseSensitive?: boolean;
    minLength?: number;
    maxLength?: number;
  };
  weight: number; // 0-1, for scoring
}

// DLP Exception
export interface DLPException {
  id: string;
  description: string;
  condition: DLPCondition;
  justification: string;
  approver: string;
  expiresAt?: string;
  active: boolean;
}

// DLP Policy Definition
export interface DLPPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: {
    dataTypes?: DataType[];
    riskLevels?: RiskLevel[];
    users?: string[];
    roles?: string[];
    departments?: string[];
    locations?: string[];
    violationTypes?: string[];
    dataSources?: string[];
    customConditions?: DLPCondition[];
  };
  actions: DLPAction[];
  exemptions: DLPPolicyExemption[];
  metadata: {
    category: string;
    owner: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    reviewDate?: string;
    complianceImpact: string[];
  };
}

// DLP Action
export interface DLPAction {
  id: string;
  type: DLPActionType;
  params: Record<string, any>;
  conditions?: DLPCondition[]; // Additional conditions for this action
  order: number; // Execution order
  async: boolean; // Execute asynchronously
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

// DLP Action Types
export type DLPActionType =
  | "MASK" // Apply masking
  | "ENCRYPT" // Apply encryption
  | "BLOCK" // Block access/operation
  | "ALERT" // Send alert/notification
  | "QUARANTINE" // Quarantine data
  | "LOG" // Log incident
  | "REDIRECT" // Redirect to secure channel
  | "REQUIRE_APPROVAL" // Require manual approval
  | "WATERMARK" // Add watermark
  | "COPY_PROTECT" // Apply copy protection
  | "ACCESS_CONTROL"; // Apply access restrictions

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
    scanDuration: number; // ms
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
    context?: string; // Surrounding context
  };
  riskScore: number; // 0-100
  remediation?: string;
  falsePositive?: boolean;
}

// DLP Action Result
export interface DLPActionResult {
  actionId: string;
  type: DLPActionType;
  status: "success" | "error" | "skipped" | "pending";
  result?: {
    processedData?: any;
    encrypted?: boolean;
    masked?: boolean;
    blocked?: boolean;
    quarantined?: boolean;
    alerted?: boolean;
    custom?: any;
  };
  error?: string;
  duration?: number; // ms
  metadata?: Record<string, any>;
}

// DLP Configuration
export interface DLPConfig {
  version: string;
  enabled: boolean;
  scanMode: "SYNC" | "ASYNC" | "STREAMING";
  batchSize: number;
  timeout: number; // ms
  retryCount: number;
  cache: {
    enabled: boolean;
    ttl: number; // seconds
    maxSize: number; // entries
  };
  classification: {
    confidenceThreshold: number; // 0-1
    enableML: boolean;
    enableRegex: boolean;
    enableKeyword: boolean;
    models: string[];
    customClassifiers: string[];
  };
  masking: {
    defaultMethod: MaskingMethod;
    preserveFormat: boolean;
    visibleChars: number;
    tokenVault: {
      enabled: boolean;
      endpoint: string;
      apiKey: string;
    };
  };
  encryption: {
    defaultAlgorithm: EncryptionAlgorithm;
    keyRotationDays: number;
    keyManagement: "LOCAL" | "AWS_KMS" | "AZURE_KEYVAULT" | "GCP_KMS";
    kmsConfig?: {
      region: string;
      keyId: string;
      endpoint?: string;
    };
  };
  audit: {
    storage: "MEMORY" | "DATABASE" | "FILE" | "SIEM";
    retentionDays: number;
    logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
    includeSensitiveData: boolean;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
  };
  quarantine: {
    enabled: boolean;
    retentionDays: number;
    autoApproval: boolean;
    notificationEnabled: boolean;
    storageType: "LOCAL" | "S3" | "AZURE_BLOB" | "GCS";
    storageConfig?: {
      bucket?: string;
      container?: string;
      path?: string;
      encryption?: boolean;
    };
  };
  notifications: {
    channels: ("EMAIL" | "SLACK" | "WEBHOOK" | "SMS")[];
    templates: {
      [key: string]: {
        subject?: string;
        body: string;
        variables?: string[];
      };
    };
    throttle: {
      maxPerMinute: number;
      maxPerHour: number;
      maxPerDay: number;
    };
  };
  performance: {
    maxConcurrentScans: number;
    queueSize: number;
    workerThreads: number;
    memoryLimit: number; // MB
  };
  compliance: {
    frameworks: ComplianceFramework[];
    reporting: {
      enabled: boolean;
      frequency: "DAILY" | "WEEKLY" | "MONTHLY";
      recipients: string[];
    };
  };
}

// Audit Log Entry
export interface AuditLog {
  id: string;
  timestamp: string;
  type:
    | "SCAN"
    | "RULE_CHANGE"
    | "POLICY_CHANGE"
    | "QUARANTINE"
    | "ALERT"
    | "CUSTOM_ACTION";
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
  metadata: Record<string, any>;
}

// Quarantine Record
export interface QuarantineRecord {
  id: string;
  scanId?: string;
  timestamp: string;
  userId: string;
  dataSource?: string;
  data?: any;
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
  metadata?: Record<string, any>;
}

// DLP Statistics
export interface DLPStats {
  period: {
    start: string;
    end: string;
  };
  scans: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    dataProcessed: number; // bytes
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
  quarantine: {
    active: number;
    released: number;
    deleted: number;
    expired: number;
  };
  performance: {
    throughput: number; // scans/sec
    latency: {
      p50: number;
      p95: number;
      p99: number;
    };
    errorRate: number;
    cacheHitRate: number;
  };
}

// DLP Policy Exemption
export interface DLPPolicyExemption {
  id: string;
  description: string;
  condition: DLPCondition;
  reason: string;
  approver: string;
  approvedAt: string;
  expiresAt?: string;
  active: boolean;
  usageCount: number;
  maxUses?: number;
}

// DLP Report
export interface DLPReport {
  id: string;
  type: "COMPLIANCE" | "INCIDENT" | "TREND" | "SUMMARY";
  period: {
    start: string;
    end: string;
  };
  generatedAt: string;
  generatedBy: string;
  summary: {
    totalScans: number;
    totalViolations: number;
    riskDistribution: Record<RiskLevel, number>;
    complianceStatus: Record<string, string>;
  };
  details: {
    topViolations: Array<{
      ruleId: string;
      count: number;
      severity: ViolationSeverity;
    }>;
    dataTypes: Array<{
      type: DataType;
      count: number;
      riskLevel: RiskLevel;
    }>;
    users: Array<{
      userId: string;
      violationCount: number;
      riskLevel: RiskLevel;
    }>;
    recommendations: string[];
  };
  attachments?: string[];
}

// DLP Event
export interface DLPEvent {
  id: string;
  type:
    | "SCAN_STARTED"
    | "SCAN_COMPLETED"
    | "VIOLATION_DETECTED"
    | "CRITICAL_RISK"
    | "RULE_ADDED"
    | "POLICY_UPDATED";
  timestamp: string;
  source: string;
  userId?: string;
  data: any;
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
  parameters: Record<string, any>;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    latency: number; // ms
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
    | "SCAN"
    | "CLASSIFY"
    | "APPLY_POLICY"
    | "NOTIFY"
    | "QUARANTINE"
    | "CUSTOM";
  order: number;
  config: Record<string, any>;
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
  config: Record<string, any>;
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
  result?: DLPScanResult;
  error?: string;
  requestId: string;
  timestamp: string;
}

export interface DLPStatsResponse {
  success: boolean;
  stats: DLPStats;
  period: {
    start: string;
    end: string;
  };
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
  | { type: "SYSTEM_STATUS"; data: { status: string; metrics: any } }
  | { type: "RULE_UPDATED"; data: DLPRule }
  | { type: "POLICY_UPDATED"; data: DLPPolicy };

// Export all types
export * from "./dlp";
