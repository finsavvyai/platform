/**
 * DLP Core Type Definitions
 * Foundational types, enums, and basic interfaces
 */

// Core Data Types
export type DataType =
  | "PII"
  | "PHI"
  | "FINANCIAL"
  | "CONFIDENTIAL"
  | "INTERNAL"
  | "PUBLIC"
  | "UNKNOWN";

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
  | "FULL"
  | "PARTIAL"
  | "TOKENIZATION"
  | "HASH"
  | "NULLIFY"
  | "NOISE"
  | "GENERALIZE"
  | "SUPPRESSION";

// Encryption Algorithms
export type EncryptionAlgorithm =
  | "AES-128-GCM"
  | "AES-256-GCM"
  | "AES-256-CBC"
  | "RSA-2048"
  | "RSA-4096"
  | "CHACHA20-POLY1305";

// DLP Action Types
export type DLPActionType =
  | "MASK"
  | "ENCRYPT"
  | "BLOCK"
  | "ALERT"
  | "QUARANTINE"
  | "LOG"
  | "REDIRECT"
  | "REQUIRE_APPROVAL"
  | "WATERMARK"
  | "COPY_PROTECT"
  | "ACCESS_CONTROL";

// Condition value types
export type DLPConditionValue =
  string | number | boolean | string[] | number[];

// Scan data input
export type ScanDataInput =
  string | Buffer | Record<string, unknown>;

// Processed data after preprocessing
export interface ProcessedData {
  text?: string;
  binary?: Buffer;
  value?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Classification prediction from a single classifier
export interface ClassificationPrediction {
  type: DataType;
  confidence: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// Aggregated classification prediction result
export interface AggregatedPrediction {
  type: DataType;
  confidence: number;
  tags: string[];
  metadata: Record<string, unknown>;
}

// DLP scan context
export interface DLPScanContext {
  roles?: string[];
  department?: string;
  location?: string;
  device?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  userId?: string;
}

// Compliance Frameworks
export interface ComplianceFramework {
  name: string;
  version: string;
  requirements: string[];
  status: "COMPLIANT" | "NON_COMPLIANT" | "PARTIALLY_COMPLIANT";
  lastAssessed: string;
}

// Data Classification Result
export interface DataClassification {
  type: DataType;
  confidence: number;
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
  sensitivityScore?: number;
  retentionPeriod?: number;
  complianceFrameworks?: ComplianceFramework[];
}
