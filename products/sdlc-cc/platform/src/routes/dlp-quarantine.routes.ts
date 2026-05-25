/**
 * DLP Quarantine Routes
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

export default router;
