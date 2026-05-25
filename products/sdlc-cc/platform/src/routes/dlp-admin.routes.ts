/**
 * DLP Admin Routes: Audit, Reports, Config, Health/Status/Metrics
 */

import { Router } from "express";
import {
  dlpController,
  authenticate,
  authorize,
  validateRequest,
  auditLog,
  body,
  param,
  query,
} from "./dlp-shared";

const router = Router();

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

export default router;
