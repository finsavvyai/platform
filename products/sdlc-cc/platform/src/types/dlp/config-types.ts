/**
 * DLP Configuration Types
 */

import type { MaskingMethod, EncryptionAlgorithm, ComplianceFramework } from "./core-types";

export interface DLPConfig {
  version: string;
  enabled: boolean;
  scanMode: "SYNC" | "ASYNC" | "STREAMING";
  batchSize: number;
  timeout: number;
  retryCount: number;
  cache: { enabled: boolean; ttl: number; maxSize: number };
  classification: {
    confidenceThreshold: number;
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
    tokenVault: { enabled: boolean; endpoint: string; apiKey: string };
  };
  encryption: {
    defaultAlgorithm: EncryptionAlgorithm;
    keyRotationDays: number;
    keyManagement: "LOCAL" | "AWS_KMS" | "AZURE_KEYVAULT" | "GCP_KMS";
    kmsConfig?: { region: string; keyId: string; endpoint?: string };
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
    storageConfig?: { bucket?: string; container?: string; path?: string; encryption?: boolean };
  };
  notifications: {
    channels: ("EMAIL" | "SLACK" | "WEBHOOK" | "SMS")[];
    templates: { [key: string]: { subject?: string; body: string; variables?: string[] } };
    throttle: { maxPerMinute: number; maxPerHour: number; maxPerDay: number };
  };
  performance: {
    maxConcurrentScans: number;
    queueSize: number;
    workerThreads: number;
    memoryLimit: number;
  };
  compliance: {
    frameworks: ComplianceFramework[];
    reporting: { enabled: boolean; frequency: "DAILY" | "WEEKLY" | "MONTHLY"; recipients: string[] };
  };
}
