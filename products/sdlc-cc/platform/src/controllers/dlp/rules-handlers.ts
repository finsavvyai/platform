/**
 * DLP Rules Handlers
 * CRUD operations and testing for DLP rules
 */

import { Request, Response, NextFunction } from "express";
import { DLPService } from "@/services/dlp/DLPService";
import type {
  DLPRule,
  DLPRulesResponse,
  ViolationSeverity,
} from "@/types/dlp";
import { ApiResponse } from "@/types/common";
import { logger } from "@/utils/logger";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";

export class DLPRulesHandlers {
  constructor(private dlpService: DLPService) {}

  /**
   * Get DLP rules
   * GET /api/v1/dlp/rules
   */
  @authenticate
  @authorize({ permissions: ["dlp:rules:read"] })
  async getRules(
    req: Request, res: Response, next: NextFunction,
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const severity = req.query.severity as ViolationSeverity;
      const enabled = req.query.enabled;

      const allRules = await this.dlpService.getAllRules();

      let filteredRules = allRules;
      if (severity) {
        filteredRules = filteredRules.filter(
          (rule) => rule.severity === severity,
        );
      }
      if (enabled !== undefined) {
        const isEnabled = enabled === "true";
        filteredRules = filteredRules.filter(
          (rule) => rule.enabled === isEnabled,
        );
      }

      const total = filteredRules.length;
      const startIndex = (page - 1) * pageSize;
      const rules = filteredRules.slice(
        startIndex, startIndex + pageSize,
      );

      const response: DLPRulesResponse = {
        success: true, rules, total, page, pageSize,
        requestId: req.id, timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error("Get DLP rules error", { error: error.message });
      next(error);
    }
  }

  /**
   * Create new DLP rule
   * POST /api/v1/dlp/rules
   */
  @authenticate
  @authorize({ permissions: ["dlp:rules:create"] })
  async createRule(
    req: Request, res: Response, next: NextFunction,
  ): Promise<void> {
    try {
      const rule: DLPRule = req.body;
      rule.metadata = {
        ...rule.metadata,
        author: req.user?.id || "system",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1, triggerCount: 0, falsePositiveRate: 0,
      };

      await this.dlpService.addRule(rule);

      logger.info("DLP rule created", {
        ruleId: rule.id, name: rule.name,
        author: rule.metadata.author,
      });

      res.status(201).json({
        success: true, data: { ruleId: rule.id },
        message: "Rule created successfully",
        requestId: req.id, timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Create DLP rule error", {
        error: error.message, userId: req.user?.id,
      });
      next(error);
    }
  }

  /**
   * Update DLP rule
   * PUT /api/v1/dlp/rules/:id
   */
  @authenticate
  @authorize({ permissions: ["dlp:rules:update"] })
  async updateRule(
    req: Request, res: Response, next: NextFunction,
  ): Promise<void> {
    try {
      const ruleId = req.params.id;
      const updates = req.body;
      updates.metadata = {
        ...updates.metadata,
        updatedAt: new Date().toISOString(),
        version: (updates.metadata?.version || 0) + 1,
      };

      await this.dlpService.updateRule(ruleId, updates);

      logger.info("DLP rule updated", {
        ruleId, updatedBy: req.user?.id,
      });

      res.json({
        success: true, message: "Rule updated successfully",
        requestId: req.id, timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Update DLP rule error", {
        error: error.message, ruleId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * Delete DLP rule
   * DELETE /api/v1/dlp/rules/:id
   */
  @authenticate
  @authorize({ permissions: ["dlp:rules:delete"] })
  async deleteRule(
    req: Request, res: Response, next: NextFunction,
  ): Promise<void> {
    try {
      const ruleId = req.params.id;
      await this.dlpService.removeRule(ruleId);

      logger.info("DLP rule deleted", {
        ruleId, deletedBy: req.user?.id,
      });

      res.json({
        success: true, message: "Rule deleted successfully",
        requestId: req.id, timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Delete DLP rule error", {
        error: error.message, ruleId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * Test DLP rule
   * POST /api/v1/dlp/rules/test
   */
  @authenticate
  @authorize({ permissions: ["dlp:rules:test"] })
  async testRule(
    req: Request, res: Response, next: NextFunction,
  ): Promise<void> {
    try {
      const rule = req.body.rule;
      const testData = req.body.data;
      const result = await this.dlpService.testRule(rule, testData);

      res.json({
        success: true, data: result,
        requestId: req.id, timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Test DLP rule error", {
        error: error.message, userId: req.user?.id,
      });
      next(error);
    }
  }
}
