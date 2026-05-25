/**
 * DLP Controller - Orchestrates all DLP route handlers
 */

import { Request, Response, NextFunction } from "express";
import { DLPService } from "@/services/dlp/DLPService";
import type { DLPScanResult, DLPConfig } from "@/types/dlp";
import { ApiResponse } from "@/types/common";
import { logger } from "@/utils/logger";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { DLPScanHandlers } from "./scan-handlers";
import { DLPRulesHandlers } from "./rules-handlers";
import { DLPPolicyQuarantineHandlers, sanitizeConfig } from "./policy-quarantine-handlers";
import { DLPAuditReportHandlers } from "./audit-report-handlers";

type Handler = [Request, Response, NextFunction];

export class DLPController {
  private dlpService: DLPService;
  private scan: DLPScanHandlers;
  private rules: DLPRulesHandlers;
  private policy: DLPPolicyQuarantineHandlers;
  private audit: DLPAuditReportHandlers;

  constructor(dlpService: DLPService) {
    this.dlpService = dlpService;
    this.scan = new DLPScanHandlers(dlpService);
    this.rules = new DLPRulesHandlers(dlpService);
    this.policy = new DLPPolicyQuarantineHandlers(dlpService);
    this.audit = new DLPAuditReportHandlers(dlpService);
    this.setupEventListeners();
  }

  // Scan
  scanData = (...a: Handler) => this.scan.scanData(...a);
  scanBatch = (...a: Handler) => this.scan.scanBatch(...a);
  scanStream = (...a: Handler) => this.scan.scanStream(...a);
  // Rules
  getRules = (...a: Handler) => this.rules.getRules(...a);
  createRule = (...a: Handler) => this.rules.createRule(...a);
  updateRule = (...a: Handler) => this.rules.updateRule(...a);
  deleteRule = (...a: Handler) => this.rules.deleteRule(...a);
  testRule = (...a: Handler) => this.rules.testRule(...a);
  // Policy & quarantine
  getPolicies = (...a: Handler) => this.policy.getPolicies(...a);
  createPolicy = (...a: Handler) => this.policy.createPolicy(...a);
  getQuarantine = (...a: Handler) => this.policy.getQuarantine(...a);
  releaseQuarantine = (...a: Handler) => this.policy.releaseQuarantine(...a);
  deleteQuarantine = (...a: Handler) => this.policy.deleteQuarantine(...a);
  // Audit & reports
  getAuditLogs = (...a: Handler) => this.audit.getAuditLogs(...a);
  generateReport = (...a: Handler) => this.audit.generateReport(...a);

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeRange = {
        start: (req.query.start as string) || new Date(Date.now() - 86400000).toISOString(),
        end: (req.query.end as string) || new Date().toISOString(),
      };
      res.json({ success: true, stats: await this.dlpService.getStats(timeRange),
        period: timeRange, requestId: req.id, timestamp: new Date().toISOString() });
    } catch (error) { logger.error("Get DLP stats error", { error: error.message }); next(error); }
  }

  @authenticate @authorize({ permissions: ["dlp:config:read"] })
  async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ success: true, data: sanitizeConfig(await this.dlpService.getConfig()),
        requestId: req.id, timestamp: new Date().toISOString() } as ApiResponse);
    } catch (error) { logger.error("Get DLP config error", { error: error.message }); next(error); }
  }

  @authenticate @authorize({ permissions: ["dlp:config:update"] })
  async updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.dlpService.updateConfig(req.body, req.user?.id);
      logger.info("DLP configuration updated", { updatedBy: req.user?.id });
      res.json({ success: true, message: "Configuration updated successfully",
        requestId: req.id, timestamp: new Date().toISOString() } as ApiResponse);
    } catch (error) { logger.error("Update DLP config error", { error: error.message }); next(error); }
  }

  async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ success: true, data: await this.dlpService.getHealthStatus(),
        requestId: req.id, timestamp: new Date().toISOString() } as ApiResponse);
    } catch (error) { logger.error("Get DLP health error", { error: error.message }); next(error); }
  }

  private setupEventListeners(): void {
    this.dlpService.on("criticalRiskDetected", async (r) => {
      logger.warn("Critical DLP risk detected", {
        scanId: r.scanId, userId: r.userId, violations: r.violations.length });
    });
    this.dlpService.on("scanCompleted", () => {});
  }
}
