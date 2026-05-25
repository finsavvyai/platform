'use strict';

import { Request, Response, NextFunction } from 'express';
import { AuditLogger } from './AuditLogger.js';
import { AuditAction, AuditCategory } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Audit Middleware
 * Automatically logs HTTP requests and user actions
 */
export class AuditMiddleware {
  private auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Express middleware that logs all requests
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const originalSend = res.send;

      // Capture response
      res.send = function (data: any) {
        const duration = Date.now() - startTime;

        // Log request asynchronously
        this.auditMiddleware
          ? this.auditMiddleware
          : (async () => {
              try {
                const ipAddress = this.getClientIp(req);
                const userAgent = req.get('user-agent') || 'unknown';

                await this.auditLogger.log({
                  userId: req.user?.userId || 'anonymous',
                  userEmail: req.user?.email || undefined,
                  action: 'api_access' as AuditAction,
                  category: 'api_access',
                  projectId: req.query.projectId as string | undefined,
                  resourceId: req.params.id,
                  resourceType: req.baseUrl?.split('/')[1],
                  description: `${req.method} ${req.originalUrl}`,
                  ipAddress,
                  userAgent,
                  status: res.statusCode >= 400 ? 'failure' : 'success',
                  errorMessage: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
                  metadata: {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    duration,
                  },
                });
              } catch (error) {
                logger.error('Failed to log audit entry:', error);
              }
            })();

        return originalSend.call(this, data);
      }.bind(res);

      next();
    };
  }

  /**
   * Decorator for logging specific actions
   */
  auditAction(action: AuditAction, category: AuditCategory) {
    return (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ): PropertyDescriptor => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const req = args[0] as Request;
        const startTime = Date.now();

        try {
          const result = await originalMethod.apply(this, args);

          const duration = Date.now() - startTime;
          const ipAddress = this.getClientIp(req);
          const userAgent = req.get('user-agent') || 'unknown';

          await this.auditLogger.log({
            userId: req.user?.userId || 'anonymous',
            userEmail: req.user?.email || undefined,
            action,
            category,
            projectId: req.query.projectId as string | undefined,
            resourceId: req.params.id,
            description: `${action} by ${req.user?.email || 'anonymous'}`,
            ipAddress,
            userAgent,
            status: 'success',
            metadata: {
              method: propertyKey,
              duration,
              result: typeof result === 'object' ? Object.keys(result) : undefined,
            },
          });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          const ipAddress = this.getClientIp(req);
          const userAgent = req.get('user-agent') || 'unknown';
          const errorMsg = error instanceof Error ? error.message : String(error);

          await this.auditLogger.log({
            userId: req.user?.userId || 'anonymous',
            userEmail: req.user?.email || undefined,
            action,
            category,
            projectId: req.query.projectId as string | undefined,
            resourceId: req.params.id,
            description: `${action} failed for ${req.user?.email || 'anonymous'}`,
            ipAddress,
            userAgent,
            status: 'failure',
            errorMessage: errorMsg,
            metadata: {
              method: propertyKey,
              duration,
              error: errorMsg,
            },
          });

          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Helper to extract client IP
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      (req.socket.remoteAddress as string) ||
      'unknown'
    );
  }
}

/**
 * Factory function to create audit middleware
 */
export function createAuditMiddleware(auditLogger: AuditLogger) {
  const middleware = new AuditMiddleware(auditLogger);
  return middleware.middleware();
}
