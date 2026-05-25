/**
 * DLP Extension Routes: Integrations, ML Models, and Workflows
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
} from "./dlp-shared";

const router = Router();

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
