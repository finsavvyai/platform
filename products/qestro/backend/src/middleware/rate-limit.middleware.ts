/**
 * Rate Limit Middleware Stub
 * Placeholder for rate limiting middleware
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Create a rate limiter
 */
export const createRateLimiter = (windowMs: number, max: number, message?: string) => {
    return rateLimit({
        windowMs,
        max,
        message: message || 'Too many requests, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
    });
};

/**
 * Default API rate limiter
 */
export const apiLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per 15 minutes
);

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictLimiter = createRateLimiter(
    15 * 60 * 1000,
    10,
    'Too many attempts, please try again later',
);

/**
 * Rate limit by user subscription
 */
export const subscriptionBasedLimiter = (req: Request, res: Response, next: NextFunction): void => {
    // Pass through - implement subscription-based limiting
    next();
};

export { createRateLimiter as rateLimit };
