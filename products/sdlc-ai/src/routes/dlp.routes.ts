/**
 * DLP Routes
 * Defines API endpoints for Data Loss Prevention operations
 */

import { Router } from "express";
import { DLPController } from "@/controllers/dlp.controller";
import { DLPService } from "@/services/dlp/DLPService";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validateRequest } from "@/middleware/validation";
import { rateLimit } from "@/middleware/rateLimit";
import { auditLog } from "@/middleware/audit";
import { body, param, query } from "express-validator";

const router = Router();
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

const dlpController = new DLPController(dlpService);

// DLP Scanning Routes
router.post(
  "/scan",
  authenticate,
  rateLimit({ max: 100, windowMs: 60000 }),
  [
    body("data").notEmpty().withMessage("Data is required"),
    body("dataSource").optional().isString(),
    body("context").optional().isObject(),
    body("options").optional().isObject(),
  ],
  validateRequest,
  auditLog({ action: "DLP_SCAN" }),
  dlpController.scanData.bind(dlpController),
);

router.post(
  "/scan/batch",
  authenticate,
  rateLimit({ max: 10, windowMs: 60000 }),
  [
    body("requests")
      .isArray({ min: 1, max: 1000 })
      .withMessage("Requests must be an array with 1-1000 items"),
    body("requests.*.data")
      .notEmpty()
      .withMessage("Each request must have data"),
    body("requests.*.dataSource").optional().isString(),
  ],
  validateRequest,
  auditLog({ action: "DLP_BATCH_SCAN" }),
  dlpController.scanBatch.bind(dlpController),
);

router.post(
  "/scan/stream",
  authenticate,
  rateLimit({ max: 50, windowMs: 60000 }),
  auditLog({ action: "DLP_STREAM_SCAN" }),
  dlpController.scanStream.bind(dlpController),
);

// DLP Statistics Routes
router.get(
  "/stats",
  authenticate,
  authorize({ permissions: ["dlp:stats:read"] }),
  [
    query("start")
      .optional()
      .isISO8601()
      .withMessage("Start date must be valid ISO8601"),
    query("end")
      .optional()
      .isISO8601()
      .withMessage("End date must be valid ISO8601"),
  ],
  validateRequest,
  dlpController.getStats.bind(dlpController),
);

router.get(
  "/stats/dashboard",
  authenticate,
  authorize({ permissions: ["dlp:stats:read"] }),
  dlpController.getDashboardStats.bind(dlpController),
);

// DLP Rules Management Routes
router.get(
  "/rules",
  authenticate,
  authorize({ permissions: ["dlp:rules:read"] }),
  [
    query("page").optional().isInt({ min: 1 }),
    query("pageSize").optional().isInt({ min: 1, max: 100 }),
    query("severity").optional().isIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    query("enabled").optional().isBoolean(),
    query("search").optional().isString(),
  ],
  validateRequest,
  dlpController.getRules.bind(dlpController),
);

router.get(
  "/rules/:id",
  authenticate,
  authorize({ permissions: ["dlp:rules:read"] }),
  [param("id").isUUID().withMessage("Invalid rule ID")],
  validateRequest,
  dlpController.getRule.bind(dlpController),
);

router.post(
  "/rules",
  authenticate,
  authorize({ permissions: ["dlp:rules:create"] }),
  [
    body("name").notEmpty().withMessage("Rule name is required"),
    body("description").notEmpty().withMessage("Rule description is required"),
    body("severity")
      .isIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
      .withMessage("Invalid severity"),
    body("conditions")
      .isArray({ min: 1 })
      .withMessage("At least one condition is required"),
    body("conditions.*.type").isIn([
      "REGEX",
      "KEYWORD",
      "ML_MODEL",
      "ENTROPY",
      "FORMAT",
      "CUSTOM",
    ]),
    body("conditions.*.value")
      .notEmpty()
      .withMessage("Condition value is required"),
    body("dataTypes").optional().isArray(),
    body("actions")
      .isArray({ min: 1 })
      .withMessage("At least one action is required"),
  ],
  validateRequest,
  auditLog({ action: "DLP_RULE_CREATE" }),
  dlpController.createRule.bind(dlpController),
);

router.put(
  "/rules/:id",
  authenticate,
  authorize({ permissions: ["dlp:rules:update"] }),
  [
    param("id").isUUID().withMessage("Invalid rule ID"),
    body("name").optional().notEmpty(),
    body("description").optional().notEmpty(),
    body("severity").optional().isIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    body("enabled").optional().isBoolean(),
    body("conditions").optional().isArray({ min: 1 }),
    body("actions").optional().isArray({ min: 1 }),
  ],
  validateRequest,
  auditLog({ action: "DLP_RULE_UPDATE" }),
  dlpController.updateRule.bind(dlpController),
);

router.delete(
  "/rules/:id",
  authenticate,
  authorize({ permissions: ["dlp:rules:delete"] }),
  [param("id").isUUID().withMessage("Invalid rule ID")],
  validateRequest,
  auditLog({ action: "DLP_RULE_DELETE" }),
  dlpController.deleteRule.bind(dlpController),
);

router.post(
  "/rules/:id/toggle",
  authenticate,
  authorize({ permissions: ["dlp:rules:update"] }),
  [
    param("id").isUUID().withMessage("Invalid rule ID"),
    body("enabled").isBoolean().withMessage("Enabled status is required"),
  ],
  validateRequest,
  auditLog({ action: "DLP_RULE_TOGGLE" }),
  dlpController.toggleRule.bind(dlpController),
);

router.post(
  "/rules/test",
  authenticate,
  authorize({ permissions: ["dlp:rules:test"] }),
  [
    body("rule").notEmpty().withMessage("Rule is required"),
    body("data").notEmpty().withMessage("Test data is required"),
  ],
  validateRequest,
  dlpController.testRule.bind(dlpController),
);

// DLP Policies Management Routes
router.get(
  "/policies",
  authenticate,
  authorize({ permissions: ["dlp:policies:read"] }),
  [
    query("page").optional().isInt({ min: 1 }),
    query("pageSize").optional().isInt({ min: 1, max: 100 }),
    query("enabled").optional().isBoolean(),
    query("search").optional().isString(),
  ],
  validateRequest,
  dlpController.getPolicies.bind(dlpController),
);

router.get(
  "/policies/:id",
  authenticate,
  authorize({ permissions: ["dlp:policies:read"] }),
  [param("id").isUUID().withMessage("Invalid policy ID")],
  validateRequest,
  dlpController.getPolicy.bind(dlpController),
);

router.post(
  "/policies",
  authenticate,
  authorize({ permissions: ["dlp:policies:create"] }),
  [
    body("name").notEmpty().withMessage("Policy name is required"),
    body("description")
      .notEmpty()
      .withMessage("Policy description is required"),
    body("priority").isInt({ min: 1, max: 10 }),
    body("actions")
      .isArray({ min: 1 })
      .withMessage("At least one action is required"),
  ],
  validateRequest,
  auditLog({ action: "DLP_POLICY_CREATE" }),
  dlpController.createPolicy.bind(dlpController),
);

router.put(
  "/policies/:id",
  authenticate,
  authorize({ permissions: ["dlp:policies:update"] }),
  [
    param("id").isUUID().withMessage("Invalid policy ID"),
    body("name").optional().notEmpty(),
    body("description").optional().notEmpty(),
    body("enabled").optional().isBoolean(),
    body("priority").optional().isInt({ min: 1, max: 10 }),
  ],
  validateRequest,
  auditLog({ action: "DLP_POLICY_UPDATE" }),
  dlpController.updatePolicy.bind(dlpController),
);

router.delete(
  "/policies/:id",
  authenticate,
  authorize({ permissions: ["dlp:policies:delete"] }),
  [param("id").isUUID().withMessage("Invalid policy ID")],
  validateRequest,
  auditLog({ action: "DLP_POLICY_DELETE" }),
  dlpController.deletePolicy.bind(dlpController),
);

// DLP Quarantine Routes
router.get(
  "/quarantine",
  authenticate,
  authorize({ permissions: ["dlp:quarantine:read"] }),
  [
    query("page").optional().isInt({ min: 1 }),
    query("pageSize").optional().isInt({ min: 1, max: 100 }),
    query("status")
      .optional()
      .isIn(["QUARANTINED", "RELEASED", "DELETED", "EXPIRED"]),
    query("riskLevel").optional().isIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    query("userId").optional().isUUID(),
  ],
  validateRequest,
  dlpController.getQuarantine.bind(dlpController),
);

router.get(
  "/quarantine/:id",
  authenticate,
  authorize({ permissions: ["dlp:quarantine:read"] }),
  [param("id").isUUID().withMessage("Invalid quarantine ID")],
  validateRequest,
  dlpController.getQuarantineRecord.bind(dlpController),
);

router.post(
  "/quarantine/:id/release",
  authenticate,
  authorize({ permissions: ["dlp:quarantine:release"] }),
  [
    param("id").isUUID().withMessage("Invalid quarantine ID"),
    body("reason").optional().isString(),
  ],
  validateRequest,
  auditLog({ action: "DLP_QUARANTINE_RELEASE" }),
  dlpController.releaseQuarantine.bind(dlpController),
);

router.delete(
  "/quarantine/:id",
  authenticate,
  authorize({ permissions: ["dlp:quarantine:delete"] }),
  [
    param("id").isUUID().withMessage("Invalid quarantine ID"),
    body("reason").optional().isString(),
  ],
  validateRequest,
  auditLog({ action: "DLP_QUARANTINE_DELETE" }),
  dlpController.deleteQuarantine.bind(dlpController),
);

router.post(
  "/quarantine/:id/approve",
  authenticate,
  authorize({ permissions: ["dlp:quarantine:approve"] }),
  [
    param("id").isUUID().withMessage("Invalid quarantine ID"),
    body("approved").isBoolean().withMessage("Approval status is required"),
    body("reason").notEmpty().withMessage("Reason is required"),
  ],
  validateRequest,
  auditLog({ action: "DLP_QUARANTINE_APPROVE" }),
  dlpController.approveQuarantine.bind(dlpController),
);

// DLP Audit Routes
router.get(
  "/audit",
  authenticate,
  authorize({ permissions: ["dlp:audit:read"] }),
  [
    query("page").optional().isInt({ min: 1 }),
    query("pageSize").optional().isInt({ min: 1, max: 100 }),
    query("userId").optional().isUUID(),
    query("type")
      .optional()
      .isIn(["SCAN", "RULE_CHANGE", "POLICY_CHANGE", "QUARANTINE", "ALERT"]),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
  ],
  validateRequest,
  dlpController.getAuditLogs.bind(dlpController),
);

router.get(
  "/audit/export",
  authenticate,
  authorize({ permissions: ["dlp:audit:export"] }),
  [
    query("startDate").isISO8601().withMessage("Start date is required"),
    query("endDate").isISO8601().withMessage("End date is required"),
    query("format").optional().isIn(["json", "csv", "pdf"]),
  ],
  validateRequest,
  auditLog({ action: "DLP_AUDIT_EXPORT" }),
  dlpController.exportAuditLogs.bind(dlpController),
);

// DLP Reports Routes
router.post(
  "/reports",
  authenticate,
  authorize({ permissions: ["dlp:reports:generate"] }),
  [
    body("type")
      .isIn(["COMPLIANCE", "INCIDENT", "TREND", "SUMMARY"])
      .withMessage("Invalid report type"),
    body("period").notEmpty().withMessage("Period is required"),
    body("period.start").isISO8601().withMessage("Invalid start date"),
    body("period.end").isISO8601().withMessage("Invalid end date"),
    body("format").optional().isIn(["json", "pdf", "csv"]),
  ],
  validateRequest,
  auditLog({ action: "DLP_REPORT_GENERATE" }),
  dlpController.generateReport.bind(dlpController),
);

router.get(
  "/reports",
  authenticate,
  authorize({ permissions: ["dlp:reports:read"] }),
  [
    query("page").optional().isInt({ min: 1 }),
    query("pageSize").optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  dlpController.getReports.bind(dlpController),
);

router.get(
  "/reports/:id",
  authenticate,
  authorize({ permissions: ["dlp:reports:read"] }),
  [param("id").isUUID().withMessage("Invalid report ID")],
  validateRequest,
  dlpController.getReport.bind(dlpController),
);

router.delete(
  "/reports/:id",
  authenticate,
  authorize({ permissions: ["dlp:reports:delete"] }),
  [param("id").isUUID().withMessage("Invalid report ID")],
  validateRequest,
  auditLog({ action: "DLP_REPORT_DELETE" }),
  dlpController.deleteReport.bind(dlpController),
);

// DLP Configuration Routes
router.get(
  "/config",
  authenticate,
  authorize({ permissions: ["dlp:config:read"] }),
  dlpController.getConfig.bind(dlpController),
);

router.put(
  "/config",
  authenticate,
  authorize({ permissions: ["dlp:config:update"] }),
  [
    body("scanMode").optional().isIn(["SYNC", "ASYNC", "STREAMING"]),
    body("batchSize").optional().isInt({ min: 1, max: 1000 }),
    body("timeout").optional().isInt({ min: 1000 }),
    body("classification.confidenceThreshold")
      .optional()
      .isFloat({ min: 0, max: 1 }),
    body("masking.defaultMethod")
      .optional()
      .isIn(["FULL", "PARTIAL", "TOKENIZATION", "HASH"]),
    body("encryption.defaultAlgorithm")
      .optional()
      .isIn(["AES-128-GCM", "AES-256-GCM", "AES-256-CBC"]),
  ],
  validateRequest,
  auditLog({ action: "DLP_CONFIG_UPDATE" }),
  dlpController.updateConfig.bind(dlpController),
);

router.post(
  "/config/validate",
  authenticate,
  authorize({ permissions: ["dlp:config:validate"] }),
  [body("config").notEmpty().withMessage("Configuration is required")],
  validateRequest,
  dlpController.validateConfig.bind(dlpController),
);

// DLP Health and Status Routes
router.get(
  "/health",
  authenticate,
  dlpController.getHealth.bind(dlpController),
);

router.get(
  "/status",
  authenticate,
  authorize({ permissions: ["dlp:status:read"] }),
  dlpController.getStatus.bind(dlpController),
);

router.get(
  "/metrics",
  authenticate,
  authorize({ permissions: ["dlp:metrics:read"] }),
  dlpController.getMetrics.bind(dlpController),
);

// DLP Integration Routes
router.get(
  "/integrations",
  authenticate,
  authorize({ permissions: ["dlp:integrations:read"] }),
  dlpController.getIntegrations.bind(dlpController),
);

router.post(
  "/integrations",
  authenticate,
  authorize({ permissions: ["dlp:integrations:create"] }),
  [
    body("type")
      .isIn(["SIEM", "CASB", "DAM", "IAM", "CUSTOM"])
      .withMessage("Invalid integration type"),
    body("config").notEmpty().withMessage("Configuration is required"),
    body("config.endpoint").isURL().withMessage("Valid endpoint is required"),
  ],
  validateRequest,
  auditLog({ action: "DLP_INTEGRATION_CREATE" }),
  dlpController.createIntegration.bind(dlpController),
);

router.put(
  "/integrations/:id",
  authenticate,
  authorize({ permissions: ["dlp:integrations:update"] }),
  [
    param("id").isUUID().withMessage("Invalid integration ID"),
    body("config").optional().notEmpty(),
    body("enabled").optional().isBoolean(),
  ],
  validateRequest,
  auditLog({ action: "DLP_INTEGRATION_UPDATE" }),
  dlpController.updateIntegration.bind(dlpController),
);

router.delete(
  "/integrations/:id",
  authenticate,
  authorize({ permissions: ["dlp:integrations:delete"] }),
  [param("id").isUUID().withMessage("Invalid integration ID")],
  validateRequest,
  auditLog({ action: "DLP_INTEGRATION_DELETE" }),
  dlpController.deleteIntegration.bind(dlpController),
);

router.post(
  "/integrations/:id/test",
  authenticate,
  authorize({ permissions: ["dlp:integrations:test"] }),
  [param("id").isUUID().withMessage("Invalid integration ID")],
  validateRequest,
  dlpController.testIntegration.bind(dlpController),
);

// DLP ML Models Routes
router.get(
  "/models",
  authenticate,
  authorize({ permissions: ["dlp:models:read"] }),
  dlpController.getModels.bind(dlpController),
);

router.post(
  "/models",
  authenticate,
  authorize({ permissions: ["dlp:models:create"] }),
  [
    body("name").notEmpty().withMessage("Model name is required"),
    body("type").isIn([
      "CLASSIFICATION",
      "ANOMALY_DETECTION",
      "SEQUENCE_DETECTION",
    ]),
    body("modelPath").notEmpty().withMessage("Model path is required"),
  ],
  validateRequest,
  auditLog({ action: "DLP_MODEL_CREATE" }),
  dlpController.createModel.bind(dlpController),
);

router.put(
  "/models/:id",
  authenticate,
  authorize({ permissions: ["dlp:models:update"] }),
  [
    param("id").isUUID().withMessage("Invalid model ID"),
    body("enabled").optional().isBoolean(),
    body("confidenceThreshold").optional().isFloat({ min: 0, max: 1 }),
  ],
  validateRequest,
  auditLog({ action: "DLP_MODEL_UPDATE" }),
  dlpController.updateModel.bind(dlpController),
);

router.delete(
  "/models/:id",
  authenticate,
  authorize({ permissions: ["dlp:models:delete"] }),
  [param("id").isUUID().withMessage("Invalid model ID")],
  validateRequest,
  auditLog({ action: "DLP_MODEL_DELETE" }),
  dlpController.deleteModel.bind(dlpController),
);

// DLP Workflows Routes
router.get(
  "/workflows",
  authenticate,
  authorize({ permissions: ["dlp:workflows:read"] }),
  dlpController.getWorkflows.bind(dlpController),
);

router.post(
  "/workflows",
  authenticate,
  authorize({ permissions: ["dlp:workflows:create"] }),
  [
    body("name").notEmpty().withMessage("Workflow name is required"),
    body("description")
      .notEmpty()
      .withMessage("Workflow description is required"),
    body("steps")
      .isArray({ min: 1 })
      .withMessage("At least one step is required"),
  ],
  validateRequest,
  auditLog({ action: "DLP_WORKFLOW_CREATE" }),
  dlpController.createWorkflow.bind(dlpController),
);

router.post(
  "/workflows/:id/execute",
  authenticate,
  authorize({ permissions: ["dlp:workflows:execute"] }),
  [
    param("id").isUUID().withMessage("Invalid workflow ID"),
    body("data").notEmpty().withMessage("Data is required"),
  ],
  validateRequest,
  auditLog({ action: "DLP_WORKFLOW_EXECUTE" }),
  dlpController.executeWorkflow.bind(dlpController),
);

export default router;
