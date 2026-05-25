/**
 * DLP Policy and Quarantine Handlers
 */

import { Request, Response, NextFunction } from "express";
import { DLPService } from "@/services/dlp/DLPService";
import type { DLPPolicy, DLPPoliciesResponse, DLPConfig, RiskLevel } from "@/types/dlp";
import { ApiResponse } from "@/types/common";
import { logger } from "@/utils/logger";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";

export class DLPPolicyQuarantineHandlers {
  constructor(private dlpService: DLPService) {}

  @authenticate @authorize({ permissions: ["dlp:policies:read"] })
  async getPolicies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      let policies = await this.dlpService.getAllPolicies();
      if (req.query.enabled !== undefined)
        policies = policies.filter((p) => p.enabled === (req.query.enabled === "true"));
      const total = policies.length;
      const start = (page - 1) * pageSize;
      const response: DLPPoliciesResponse = {
        success: true, policies: policies.slice(start, start + pageSize),
        total, page, pageSize, requestId: req.id, timestamp: new Date().toISOString(),
      };
      res.json(response);
    } catch (error) { logger.error("Get DLP policies error", { error: error.message }); next(error); }
  }

  @authenticate @authorize({ permissions: ["dlp:policies:create"] })
  async createPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const policy: DLPPolicy = req.body;
      policy.metadata = { ...policy.metadata, owner: req.user?.id || "system",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 };
      await this.dlpService.addPolicy(policy);
      logger.info("DLP policy created", { policyId: policy.id, name: policy.name, owner: policy.metadata.owner });
      res.status(201).json({ success: true, data: { policyId: policy.id },
        message: "Policy created successfully", requestId: req.id, timestamp: new Date().toISOString() } as ApiResponse);
    } catch (error) { logger.error("Create DLP policy error", { error: error.message }); next(error); }
  }

  @authenticate @authorize({ permissions: ["dlp:quarantine:read"] })
  async getQuarantine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const records = await this.dlpService.getQuarantineRecords({
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 20,
        filters: { status: req.query.status as string, riskLevel: req.query.riskLevel as RiskLevel },
      });
      res.json({ success: true, data: records, requestId: req.id, timestamp: new Date().toISOString() } as ApiResponse);
    } catch (error) { logger.error("Get quarantine error", { error: error.message }); next(error); }
  }

  @authenticate @authorize({ permissions: ["dlp:quarantine:release"] })
  async releaseQuarantine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.dlpService.releaseQuarantine(req.params.id, req.user?.id, req.body.reason);
      logger.info("Quarantine released", { recordId: req.params.id, releasedBy: req.user?.id });
      res.json({ success: true, message: "Quarantine record released successfully",
        requestId: req.id, timestamp: new Date().toISOString() } as ApiResponse);
    } catch (error) { logger.error("Release quarantine error", { error: error.message }); next(error); }
  }

  @authenticate @authorize({ permissions: ["dlp:quarantine:delete"] })
  async deleteQuarantine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.dlpService.deleteQuarantine(req.params.id, req.user?.id, req.body.reason);
      logger.info("Quarantine deleted", { recordId: req.params.id, deletedBy: req.user?.id });
      res.json({ success: true, message: "Quarantine record deleted successfully",
        requestId: req.id, timestamp: new Date().toISOString() } as ApiResponse);
    } catch (error) { logger.error("Delete quarantine error", { error: error.message }); next(error); }
  }
}

export function sanitizeConfig(config: DLPConfig): Partial<DLPConfig> {
  const s = { ...config };
  if (s.encryption?.kmsConfig) delete s.encryption.kmsConfig.apiKey;
  if (s.notifications) { delete s.notifications.webhookSecret; delete s.notifications.smtpPassword; }
  return s;
}
