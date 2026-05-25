/**
 * Audit Middleware Stub
 * Placeholder for audit logging middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Log audit events
 */
export const auditLog = (action: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const auditEntry = {
            action,
            userId: req.user?.userId,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString(),
        };

        logger.info('Audit log:', auditEntry);
        next();
    };
};

/**
 * Audit middleware for resource access
 */
export const auditResourceAccess = (resourceType: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const auditEntry = {
            resourceType,
            resourceId: req.params.id || req.params.projectId,
            userId: req.user?.userId,
            action: req.method,
            timestamp: new Date().toISOString(),
        };

        logger.info('Resource access:', auditEntry);
        next();
    };
};

export { auditLog as audit };
