/**
 * Rate Limit Middleware - Express Integration
 *
 * Express middleware that applies rate limiting to all requests.
 * Sets standard rate limit headers and returns 429 when exceeded.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger.js';
import RateLimiter from './RateLimiter.js';
import type { RateLimitTier } from './types.js';

/**
 * Extract rate limit key from request
 * Prefers API key if available, falls back to IP address
 */
function extractKey(req: Request): string {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && typeof apiKey === 'string') {
    return `api-key:${apiKey}`;
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Determine tier from request
 * Check user tier, API key subscription, or default to 'free'
 */
async function determineTier(req: Request): Promise<RateLimitTier> {
  // Check if user is authenticated with tier info
  const user = (req as any).user;
  if (user && user.tier) {
    return user.tier as RateLimitTier;
  }

  // Default to free tier
  return 'free';
}

/**
 * Health check endpoints that bypass rate limiting
 */
const HEALTH_CHECK_ENDPOINTS = [
  '/health',
  '/healthz',
  '/ready',
  '/api/health',
  '/api/ready',
];

/**
 * Create rate limit middleware
 * Returns Express middleware function
 */
export function rateLimitMiddleware(defaultTier: RateLimitTier = 'free') {
  const limiter = new RateLimiter();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip health checks
      if (HEALTH_CHECK_ENDPOINTS.some((ep) => req.path.startsWith(ep))) {
        return next();
      }

      // Extract key and determine tier
      const key = extractKey(req);
      const tier = await determineTier(req);

      // Check rate limit
      const result = limiter.checkLimit(key, tier);

      // Set standard rate limit headers
      res.set('X-RateLimit-Limit', String(result.limit));
      res.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
      res.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

      if (!result.allowed) {
        // Set retry-after header
        if (result.retryAfter) {
          res.set('Retry-After', String(result.retryAfter));
        }

        logger.warn(`Rate limit exceeded for ${key} (tier: ${tier}): ${result.reason}`);

        res.status(429).json({
          error: 'Too Many Requests',
          message: result.reason || 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          resetAt: new Date(result.resetAt).toISOString(),
        });
        return;
      }

      // Record the request
      limiter.recordRequest(key);

      // Attach limiter info to request for controllers
      (req as any).rateLimitInfo = {
        key,
        tier,
        remaining: result.remaining,
        limit: result.limit,
      };

      next();
    } catch (error) {
      logger.error('Rate limit middleware error:', error);
      // Allow request to proceed on error
      next();
    }
  };
}

/**
 * Middleware factory with specific tier override
 */
export function createRateLimitMiddleware(tier: RateLimitTier) {
  return rateLimitMiddleware(tier);
}

export default rateLimitMiddleware;
