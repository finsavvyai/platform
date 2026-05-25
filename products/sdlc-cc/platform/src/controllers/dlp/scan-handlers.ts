/**
 * DLP Scan Handlers
 * Single scan, batch scan, and stream scan endpoints
 */

import { Request, Response, NextFunction } from "express";
import { DLPService } from "@/services/dlp/DLPService";
import type { DLPScanRequest, DLPScanResponse, RiskLevel } from "@/types/dlp";
import { ApiResponse } from "@/types/common";
import { logger } from "@/utils/logger";
import { validateRequest } from "@/utils/validation";
import { rateLimit } from "@/middleware/rateLimit";

export class DLPScanHandlers {
  constructor(private dlpService: DLPService) {}

  /**
   * Scan data for DLP violations
   * POST /api/v1/dlp/scan
   */
  @rateLimit({ max: 100, windowMs: 60000 })
  async scanData(
    req: Request, res: Response, next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.id || "anonymous";
      const scanRequest: DLPScanRequest = {
        data: req.body.data,
        userId,
        dataSource:
          req.body.dataSource ||
          (req.headers["x-data-source"] as string) || "api",
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

      const validationResult = validateRequest(scanRequest, "dlpScan");
      if (!validationResult.valid) {
        res.status(400).json({
          success: false, error: "Validation failed",
          details: validationResult.errors,
          requestId: req.id, timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const scanResult = await this.dlpService.scanData(scanRequest);
      const response: DLPScanResponse = {
        success: true, scanId: scanResult.scanId,
        result: scanResult, requestId: req.id,
        timestamp: new Date().toISOString(),
      };

      logger.info("DLP scan completed", {
        scanId: scanResult.scanId, userId,
        riskLevel: scanResult.riskLevel,
        violations: scanResult.violations.length,
      });

      const statusCode = getStatusCodeForRiskLevel(scanResult.riskLevel);
      res.status(statusCode).json(response);
    } catch (error) {
      logger.error("DLP scan error", {
        error: error.message, userId: req.user?.id,
        stack: error.stack,
      });
      next(error);
    }
  }

  /**
   * Batch scan multiple data items
   * POST /api/v1/dlp/scan/batch
   */
  @rateLimit({ max: 10, windowMs: 60000 })
  async scanBatch(
    req: Request, res: Response, next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.id || "anonymous";
      const requests: DLPScanRequest[] = req.body.requests.map(
        (item: Partial<DLPScanRequest>) => ({
          ...item, userId,
          context: {
            ...item.context,
            roles: req.user?.roles || [],
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        }),
      );

      if (requests.length > 1000) {
        res.status(400).json({
          success: false, error: "Batch size too large",
          message: "Maximum batch size is 1000 items",
          requestId: req.id, timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      });
      res.write('{"success":true,"results":[');

      let first = true;
      for (const request of requests) {
        const result = await this.dlpService.scanData(request);
        if (!first) res.write(",");
        first = false;
        res.write(JSON.stringify(result));
        if (res.flush) res.flush();
      }

      res.write("]}");
      res.end();
    } catch (error) {
      logger.error("Batch DLP scan error", {
        error: error.message, userId: req.user?.id,
      });
      next(error);
    }
  }

  /**
   * Stream DLP scanning
   * POST /api/v1/dlp/scan/stream
   */
  async scanStream(
    req: Request, res: Response, next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.id || "anonymous";
      const scanRequest: DLPScanRequest = {
        data: req, userId,
        dataSource: (req.headers["x-data-source"] as string) || "stream",
        context: {
          roles: req.user?.roles || [],
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      };

      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Transfer-Encoding": "chunked",
        "X-DLP-Scan-Id": crypto.randomUUID(),
      });

      const processedStream = await this.dlpService.scanStream(
        req, scanRequest,
      );
      processedStream.pipe(res);

      processedStream.on("error", (error) => {
        logger.error("Stream processing error", {
          error: error.message,
        });
        if (!res.headersSent) {
          res.status(500).json({
            success: false, error: "Stream processing failed",
            requestId: req.id, timestamp: new Date().toISOString(),
          } as ApiResponse);
        }
        res.end();
      });

      processedStream.on("end", () => {
        logger.info("Stream processing completed", { userId });
      });
    } catch (error) {
      logger.error("Stream DLP scan error", {
        error: error.message, userId: req.user?.id,
      });
      next(error);
    }
  }
}

export function getStatusCodeForRiskLevel(riskLevel: RiskLevel): number {
  switch (riskLevel) {
    case "CRITICAL": return 403;
    case "HIGH": return 422;
    case "MEDIUM": return 200;
    case "LOW": return 200;
    case "NONE": return 200;
    case "ERROR": return 500;
    default: return 200;
  }
}
