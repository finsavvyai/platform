/**
 * DLP Policies Management Routes
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

export default router;
