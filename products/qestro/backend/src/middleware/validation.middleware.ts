/**
 * Validation Middleware Stub
 * Placeholder for request validation middleware
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

/**
 * Validate request body against a Zod schema
 */
export const validateBody = <T>(schema: ZodSchema<T>) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors,
                });
                return;
            }
            next(error);
        }
    };
};

/**
 * Validate request params against a Zod schema
 */
export const validateParams = <T>(schema: ZodSchema<T>) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.params = schema.parse(req.params) as any;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Invalid parameters',
                    details: error.errors,
                });
                return;
            }
            next(error);
        }
    };
};

/**
 * Validate request query against a Zod schema
 */
export const validateQuery = <T>(schema: ZodSchema<T>) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.query = schema.parse(req.query) as any;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Invalid query parameters',
                    details: error.errors,
                });
                return;
            }
            next(error);
        }
    };
};

export { validateBody as validateRequest };
