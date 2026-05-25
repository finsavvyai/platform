/**
 * DLP Scanning and Statistics Routes
 */

import { Router } from "express";
import {
  dlpController,
  authenticate,
  authorize,
  validateRequest,
  rateLimit,
  auditLog,
  body,
  query,
} from "./dlp-shared";

const router = Router();

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

export default router;
