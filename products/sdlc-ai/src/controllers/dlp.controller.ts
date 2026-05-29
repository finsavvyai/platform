/**
 * DLP Controller
 * Handles HTTP requests for Data Loss Prevention operations
 */

import { Request, Response, NextFunction } from "express";
import { DLPService } from "@/services/dlp/DLPService";
import {
  DLPScanRequest,
  DLPScanResponse,
  DLPStatsResponse,
  DLPRulesResponse,
  DLPPoliciesResponse,
  DLPRule,
  DLPPolicy,
  DLPConfig,
  AuditLog,
  QuarantineRecord,
  RiskLevel,
  DataType,
  ViolationSeverity,
} from "@/types/dlp";
import { ApiResponse } from "@/types/common";
import { logger } from "@/utils/logger";
import { validateRequest } from "@/utils/validation";
import { rateLimit } from "@/middleware/rateLimit";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";

export class DLPController {
  private dlpService: DLPService;

  constructor(dlpService: DLPService) {
    this.dlpService = dlpService;
    this.setupEventListeners();
  }

  /**
   * Scan data for DLP violations
   * POST /api/v1/dlp/scan
   */
  @rateLimit({ max: 100, windowMs: 60000 }) // 100 scans per minute
  async scanData(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.id || "anonymous";
      const scanRequest: DLPScanRequest = {
        data: req.body.data,
        userId,
        dataSource:
          req.body.dataSource ||
          (req.headers["x-data-source"] as string) ||
          "api",
        context: {
          ...req.body.context,
          roles: req.user?.roles || [],
          department: req.user?.department,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          sessionId: req.sessionID,
        },
        options: req.body.options,
      };

      // Validate request
      const validationResult = validateRequest(scanRequest, "dlpScan");
      if (!validationResult.valid) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.errors,
          requestId: req.id,
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Perform DLP scan
      const scanResult = await this.dlpService.scanData(scanRequest);

      const response: DLPScanResponse = {
        success: true,
        scanId: scanResult.scanId,
        result: scanResult,
        requestId: req.id,
        timestamp: new Date().toISOString(),
      };

      // Log scan for audit
      logger.info("DLP scan completed", {
        scanId: scanResult.scanId,
        userId,
        riskLevel: scanResult.riskLevel,
        violations: scanResult.violations.length,
      });

      // Return appropriate status based on risk level
      const statusCode = this.getStatusCodeForRiskLevel(scanResult.riskLevel);
      res.status(statusCode).json(response);
    } catch (error) {
      logger.error("DLP scan error", {
        error: error.message,
        userId: req.user?.id,
        stack: error.stack,
      });
      next(error);
    }
  }

  /**
   * Batch scan multiple data items
   * POST /api/v1/dlp/scan/batch
   */
  @rateLimit({ max: 10, windowMs: 60000 }) // 10 batch scans per minute
  async scanBatch(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.id || "anonymous";
      const requests: DLPScanRequest[] = req.body.requests.map((item: any) => ({
        ...item,
        userId,
        context: {
          ...item.context,
          roles: req.user?.roles || [],
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      }));

      // Validate batch size
      if (requests.length > 1000) {
        res.status(400).json({
          success: false,
          error: "Batch size too large",
          message: "Maximum batch size is 1000 items",
          requestId: req.id,
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Setup streaming response
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      });

      res.write('{"success":true,"results":[');

      let first = true;
      for (const request of requests) {
        const result = await this.dlpService.scanData(request);

        if (!first) {
          res.write(",");
        }
        first = false;

        res.write(JSON.stringify(result));

        // Flush to send chunk
        if (res.flush) {
          res.flush();
        }
      }

      res.write("]}");
      res.end();
    } catch (error) {
      logger.error("Batch DLP scan error", {
        error: error.message,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  /**
   * Stream DLP scanning
   * POST /api/v1/dlp/scan/stream
   */
  async scanStream(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.id || "anonymous";
      const scanRequest: DLPScanRequest = {
        data: req, // Will be overwritten by stream
        userId,
        dataSource: (req.headers["x-data-source"] as string) || "stream",
        context: {
          roles: req.user?.roles || [],
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      };

      // Set appropriate headers for streaming
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Transfer-Encoding": "chunked",
        "X-DLP-Scan-Id": crypto.randomUUID(),
      });

      // Create processing stream
      const processedStream = await this.dlpService.scanStream(
        req,
        scanRequest,
      );

      // Pipe processed data to response
      processedStream.pipe(res);

      // Handle stream events
      processedStream.on("error", (error) => {
        logger.error("Stream processing error", { error: error.message });
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: "Stream processing failed",
            requestId: req.id,
            timestamp: new Date().toISOString(),
          } as ApiResponse);
        }
        res.end();
      });

      processedStream.on("end", () => {
        logger.info("Stream processing completed", { userId });
      });
    } catch (error) {
      logger.error("Stream DLP scan error", {
        error: error.message,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  /**
   * Get DLP statistics
   * GET /api/v1/dlp/stats
   */
  async getStats(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const timeRange = {
        start:
          (req.query.start as string) ||
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: (req.query.end as string) || new Date().toISOString(),
      };

      const stats = await this.dlpService.getStats(timeRange);

      const response: DLPStatsResponse = {
        success: true,
        stats,
        period: timeRange,
        requestId: req.id,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error("Get DLP stats error", { error: error.message });
      next(error);
    }
  }

  /**
   * Get DLP rules
   * GET /api/v1/dlp/rules
   */
  @authenticate
  @authorize({ permissions: ["dlp:rules:read"] })
  async getRules(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const severity = req.query.severity as ViolationSeverity;
      const enabled = req.query.enabled;

      // Get all rules from service
      const allRules = await this.dlpService.getAllRules();

      // Apply filters
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

      // Pagination
      const total = filteredRules.length;
      const startIndex = (page - 1) * pageSize;
      const rules = filteredRules.slice(startIndex, startIndex + pageSize);

      const response: DLPRulesResponse = {
        success: true,
        rules,
        total,
        page,
        pageSize,
        requestId: req.id,
        timestamp: new Date().toISOString(),
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
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const rule: DLPRule = req.body;
      rule.metadata = {
        ...rule.metadata,
        author: req.user?.id || "system",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        triggerCount: 0,
        falsePositiveRate: 0,
      };

      await this.dlpService.addRule(rule);

      logger.info("DLP rule created", {
        ruleId: rule.id,
        name: rule.name,
        author: rule.metadata.author,
      });

      res.status(201).json({
        success: true,
        data: { ruleId: rule.id },
        message: "Rule created successfully",
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Create DLP rule error", {
        error: error.message,
        userId: req.user?.id,
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
    req: Request,
    res: Response,
    next: NextFunction,
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
        ruleId,
        updatedBy: req.user?.id,
      });

      res.json({
        success: true,
        message: "Rule updated successfully",
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Update DLP rule error", {
        error: error.message,
        ruleId: req.params.id,
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
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const ruleId = req.params.id;
      await this.dlpService.removeRule(ruleId);

      logger.info("DLP rule deleted", {
        ruleId,
        deletedBy: req.user?.id,
      });

      res.json({
        success: true,
        message: "Rule deleted successfully",
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Delete DLP rule error", {
        error: error.message,
        ruleId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * Get DLP policies
   * GET /api/v1/dlp/policies
   */
  @authenticate
  @authorize({ permissions: ["dlp:policies:read"] })
  async getPolicies(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const enabled = req.query.enabled;

      const allPolicies = await this.dlpService.getAllPolicies();

      // Apply filters
      let filteredPolicies = allPolicies;
      if (enabled !== undefined) {
        const isEnabled = enabled === "true";
        filteredPolicies = filteredPolicies.filter(
          (policy) => policy.enabled === isEnabled,
        );
      }

      // Pagination
      const total = filteredPolicies.length;
      const startIndex = (page - 1) * pageSize;
      const policies = filteredPolicies.slice(
        startIndex,
        startIndex + pageSize,
      );

      const response: DLPPoliciesResponse = {
        success: true,
        policies,
        total,
        page,
        pageSize,
        requestId: req.id,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error("Get DLP policies error", { error: error.message });
      next(error);
    }
  }

  /**
   * Create new DLP policy
   * POST /api/v1/dlp/policies
   */
  @authenticate
  @authorize({ permissions: ["dlp:policies:create"] })
  async createPolicy(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const policy: DLPPolicy = req.body;
      policy.metadata = {
        ...policy.metadata,
        owner: req.user?.id || "system",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };

      await this.dlpService.addPolicy(policy);

      logger.info("DLP policy created", {
        policyId: policy.id,
        name: policy.name,
        owner: policy.metadata.owner,
      });

      res.status(201).json({
        success: true,
        data: { policyId: policy.id },
        message: "Policy created successfully",
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Create DLP policy error", {
        error: error.message,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  /**
   * Get quarantine records
   * GET /api/v1/dlp/quarantine
   */
  @authenticate
  @authorize({ permissions: ["dlp:quarantine:read"] })
  async getQuarantine(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const status = req.query.status as string;
      const riskLevel = req.query.riskLevel as RiskLevel;

      const records = await this.dlpService.getQuarantineRecords({
        page,
        pageSize,
        filters: { status, riskLevel },
      });

      res.json({
        success: true,
        data: records,
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Get quarantine records error", { error: error.message });
      next(error);
    }
  }

  /**
   * Release quarantined data
   * POST /api/v1/dlp/quarantine/:id/release
   */
  @authenticate
  @authorize({ permissions: ["dlp:quarantine:release"] })
  async releaseQuarantine(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const recordId = req.params.id;
      const reason = req.body.reason;

      await this.dlpService.releaseQuarantine(recordId, req.user?.id, reason);

      logger.info("Quarantine record released", {
        recordId,
        releasedBy: req.user?.id,
        reason,
      });

      res.json({
        success: true,
        message: "Quarantine record released successfully",
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Release quarantine error", {
        error: error.message,
        recordId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * Delete quarantined data
   * DELETE /api/v1/dlp/quarantine/:id
   */
  @authenticate
  @authorize({ permissions: ["dlp:quarantine:delete"] })
  async deleteQuarantine(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const recordId = req.params.id;
      const reason = req.body.reason;

      await this.dlpService.deleteQuarantine(recordId, req.user?.id, reason);

      logger.info("Quarantine record deleted", {
        recordId,
        deletedBy: req.user?.id,
        reason,
      });

      res.json({
        success: true,
        message: "Quarantine record deleted successfully",
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Delete quarantine error", {
        error: error.message,
        recordId: req.params.id,
      });
      next(error);
    }
  }

  /**
   * Get audit logs
   * GET /api/v1/dlp/audit
   */
  @authenticate
  @authorize({ permissions: ["dlp:audit:read"] })
  async getAuditLogs(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const userId = req.query.userId as string;
      const type = req.query.type as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const logs = await this.dlpService.getAuditLogs({
        page,
        pageSize,
        filters: { userId, type, startDate, endDate },
      });

      res.json({
        success: true,
        data: logs,
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Get audit logs error", { error: error.message });
      next(error);
    }
  }

  /**
   * Generate DLP report
   * POST /api/v1/dlp/reports
   */
  @authenticate
  @authorize({ permissions: ["dlp:reports:generate"] })
  async generateReport(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const reportType = req.body.type;
      const period = req.body.period;
      const format = req.body.format || "json";

      const report = await this.dlpService.generateReport({
        type: reportType,
        period,
        requestedBy: req.user?.id,
        format,
      });

      // Set appropriate content type based on format
      const contentType =
        format === "pdf"
          ? "application/pdf"
          : format === "csv"
            ? "text/csv"
            : "application/json";

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="dlp-report-${report.id}.${format}"`,
      );

      if (format === "json") {
        res.json({
          success: true,
          data: report,
          requestId: req.id,
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      } else {
        // For PDF/CSV, stream the file
        res.send(report.data);
      }
    } catch (error) {
      logger.error("Generate DLP report error", {
        error: error.message,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  /**
   * Get DLP configuration
   * GET /api/v1/dlp/config
   */
  @authenticate
  @authorize({ permissions: ["dlp:config:read"] })
  async getConfig(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const config = await this.dlpService.getConfig();

      // Remove sensitive information
      const sanitizedConfig = this.sanitizeConfig(config);

      res.json({
        success: true,
        data: sanitizedConfig,
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Get DLP config error", { error: error.message });
      next(error);
    }
  }

  /**
   * Update DLP configuration
   * PUT /api/v1/dlp/config
   */
  @authenticate
  @authorize({ permissions: ["dlp:config:update"] })
  async updateConfig(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const updates = req.body;
      await this.dlpService.updateConfig(updates, req.user?.id);

      logger.info("DLP configuration updated", {
        updatedBy: req.user?.id,
      });

      res.json({
        success: true,
        message: "Configuration updated successfully",
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Update DLP config error", {
        error: error.message,
        userId: req.user?.id,
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
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const rule = req.body.rule;
      const testData = req.body.data;

      const result = await this.dlpService.testRule(rule, testData);

      res.json({
        success: true,
        data: result,
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Test DLP rule error", {
        error: error.message,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  /**
   * Get DLP health status
   * GET /api/v1/dlp/health
   */
  async getHealth(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const health = await this.dlpService.getHealthStatus();

      res.json({
        success: true,
        data: health,
        requestId: req.id,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error("Get DLP health error", { error: error.message });
      next(error);
    }
  }

  // Private helper methods
  private setupEventListeners(): void {
    // Listen for critical risk events
    this.dlpService.on("criticalRiskDetected", async (scanResult) => {
      logger.warn("Critical DLP risk detected", {
        scanId: scanResult.scanId,
        userId: scanResult.userId,
        violations: scanResult.violations.length,
      });

      // Send alert to security team
      await this.sendCriticalAlert(scanResult);
    });

    // Listen for scan completion
    this.dlpService.on("scanCompleted", (scanResult) => {
      // Update metrics
      this.updateMetrics(scanResult);
    });
  }

  private async sendCriticalAlert(scanResult: any): Promise<void> {
    // Implementation for sending critical alerts
    // This would integrate with notification systems
  }

  private updateMetrics(scanResult: any): void {
    // Implementation for updating metrics
    // This would update performance and security metrics
  }

  private getStatusCodeForRiskLevel(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case "CRITICAL":
        return 403; // Forbidden
      case "HIGH":
        return 422; // Unprocessable Entity
      case "MEDIUM":
        return 200; // OK but with warnings
      case "LOW":
        return 200; // OK
      case "NONE":
        return 200; // OK
      case "ERROR":
        return 500; // Internal Server Error
      default:
        return 200;
    }
  }

  private sanitizeConfig(config: DLPConfig): Partial<DLPConfig> {
    // Remove sensitive configuration values
    const sanitized = { ...config };

    // Remove encryption keys
    if (sanitized.encryption?.kmsConfig) {
      delete sanitized.encryption.kmsConfig.apiKey;
    }

    // Remove notification credentials
    if (sanitized.notifications) {
      delete sanitized.notifications.webhookSecret;
      delete sanitized.notifications.smtpPassword;
    }

    return sanitized;
  }
}
