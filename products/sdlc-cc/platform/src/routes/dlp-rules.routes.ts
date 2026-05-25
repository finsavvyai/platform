/**
 * DLP Rules Management Routes
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

export default router;
