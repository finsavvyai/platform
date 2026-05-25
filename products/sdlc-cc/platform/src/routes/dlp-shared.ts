/**
 * DLP Routes - Shared setup: service instance, controller, and common imports
 */

import { DLPController } from "@/controllers/dlp.controller";
import { DLPService } from "@/services/dlp/DLPService";

export { authenticate } from "@/middleware/auth";
export { authorize } from "@/middleware/authorize";
export { validateRequest } from "@/middleware/validation";
export { rateLimit } from "@/middleware/rateLimit";
export { auditLog } from "@/middleware/audit";
export { body, param, query } from "express-validator";

const dlpService = new DLPService({
  version: "1.0.0",
  enabled: true,
  scanMode: "SYNC",
  batchSize: 100,
  timeout: 30000,
  retryCount: 3,
  cache: {
    enabled: true,
    ttl: 300,
    maxSize: 10000,
  },
  classification: {
    confidenceThreshold: 0.7,
    enableML: true,
    enableRegex: true,
    enableKeyword: true,
    models: ["pii-classifier-v1", "phi-classifier-v1"],
    customClassifiers: [],
  },
  masking: {
    defaultMethod: "PARTIAL",
    preserveFormat: true,
    visibleChars: 4,
    tokenVault: {
      enabled: false,
      endpoint: "",
      apiKey: "",
    },
  },
  encryption: {
    defaultAlgorithm: "AES-256-GCM",
    keyRotationDays: 90,
    keyManagement: "LOCAL",
  },
  audit: {
    storage: "DATABASE",
    retentionDays: 365,
    logLevel: "INFO",
    includeSensitiveData: false,
    compressionEnabled: true,
    encryptionEnabled: true,
  },
  quarantine: {
    enabled: true,
    retentionDays: 30,
    autoApproval: false,
    notificationEnabled: true,
  },
  notifications: {
    channels: ["EMAIL"],
    throttle: {
      maxPerMinute: 10,
      maxPerHour: 100,
      maxPerDay: 1000,
    },
  },
  performance: {
    maxConcurrentScans: 50,
    queueSize: 1000,
    workerThreads: 4,
    memoryLimit: 2048,
  },
  compliance: {
    frameworks: [],
    reporting: {
      enabled: true,
      frequency: "WEEKLY",
      recipients: [],
    },
  },
});

export const dlpController = new DLPController(dlpService);
