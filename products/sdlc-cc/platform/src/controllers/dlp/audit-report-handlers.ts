/**
 * DLP Audit Log and Report Handlers
 */

import { Request, Response, NextFunction } from "express";
import { DLPService } from "@/services/dlp/DLPService";
import { ApiResponse } from "@/types/common";
import { logger } from "@/utils/logger";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";

export class DLPAuditReportHandlers {
  constructor(private dlpService: DLPService) {}

  @authenticate @authorize({ permissions: ["dlp:audit:read"] })
  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await this.dlpService.getAuditLogs({
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 50,
        filters: {
          userId: req.query.userId as string, type: req.query.type as string,
          startDate: req.query.startDate as string, endDate: req.query.endDate as string,
        },
      });
      res.json({ success: true, data: logs, requestId: req.id,
        timestamp: new Date().toISOString() } as ApiResponse);
    } catch (error) {
      logger.error("Get audit logs error", { error: error.message });
      next(error);
    }
  }

  @authenticate @authorize({ permissions: ["dlp:reports:generate"] })
  async generateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = req.body.format || "json";
      const report = await this.dlpService.generateReport({
        type: req.body.type, period: req.body.period,
        requestedBy: req.user?.id, format,
      });
      const contentType = format === "pdf" ? "application/pdf"
        : format === "csv" ? "text/csv" : "application/json";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition",
        `attachment; filename="dlp-report-${report.id}.${format}"`);
      if (format === "json") {
        res.json({ success: true, data: report, requestId: req.id,
          timestamp: new Date().toISOString() } as ApiResponse);
      } else {
        res.send(report.data);
      }
    } catch (error) {
      logger.error("Generate DLP report error", { error: error.message, userId: req.user?.id });
      next(error);
    }
  }
}
