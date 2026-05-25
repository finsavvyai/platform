/**
 * CacheMiddleware: Express middleware for response caching
 * GET response caching with ETags, conditional requests, and auto-invalidation
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { CacheManager } from './CacheManager.js';
import { KeyGenerator } from './types.js';

export class CacheMiddleware {
  private cacheManager: CacheManager;
  private defaultKeyGenerator: KeyGenerator;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
    this.defaultKeyGenerator = (req) =>
      `${req.method}:${req.originalUrl}`;
  }

  /**
   * Create response caching middleware
   */
  cacheResponse(
    ttlSeconds: number,
    keyGenerator?: KeyGenerator
  ) {
    const keyGen = keyGenerator ?? this.defaultKeyGenerator;
    const cacheManager = this.cacheManager;

    return async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        next();
        return;
      }

      const cacheKey = keyGen(req);
      const cached = await cacheManager.get<{
        body: any;
        headers: Record<string, string>;
        etag: string;
        statusCode: number;
      }>(cacheKey);

      if (cached) {
        // Check conditional request (If-None-Match)
        const ifNoneMatch = req.headers['if-none-match'];

        if (ifNoneMatch === cached.etag) {
          res.status(304).end();
          return;
        }

        // Return cached response
        res.status(cached.statusCode);
        Object.entries(cached.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.setHeader('X-Cache', 'HIT');
        res.json(cached.body);
        return;
      }

      // Intercept response to cache it
      const originalJson = res.json.bind(res);

      res.json = function (body: any) {
        const statusCode = res.statusCode;

        // Don't cache error responses
        if (statusCode >= 400) {
          return originalJson(body);
        }

        // Generate ETag
        const etag = `"${crypto
          .createHash('sha256')
          .update(JSON.stringify(body))
          .digest('hex')
          .substring(0, 32)}"`;

        // Get response headers to cache
        const headers = { 'Content-Type': 'application/json' };

        // Store in cache
        cacheManager
          .set(
            cacheKey,
            {
              body,
              headers,
              etag,
              statusCode,
            },
            ttlSeconds
          )
          .catch((err) =>
            console.error('Cache error:', err)
          );

        // Send response with ETag
        res.setHeader('ETag', etag);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', `max-age=${ttlSeconds}`);

        return originalJson(body);
      };

      next();
    };
  }

  /**
   * Invalidate cache on mutations
   */
  invalidateOnMutation(patterns: string[] = []) {
    return async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      // Only invalidate on mutations
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        next();
        return;
      }

      const originalJson = res.json.bind(res);

      res.json = async function (body: any) {
        // Invalidate related cache entries
        const defaultPattern = `GET:${req.baseUrl}`;

        for (const pattern of [...patterns, defaultPattern]) {
          try {
            await this.cacheManager.invalidatePattern(pattern);
          } catch (err) {
            console.error(`Cache invalidation error: ${pattern}`, err);
          }
        }

        return originalJson(body);
      }.bind({ cacheManager: this.cacheManager });

      next();
    };
  }

  /**
   * Skip caching for specific routes
   */
  skipCache(
    shouldSkip: (req: Request) => boolean
  ) {
    return (req: Request, _res: Response, next: NextFunction) => {
      if (shouldSkip(req)) {
        (req as any).skipCache = true;
      }

      next();
    };
  }

  /**
   * Middleware to clear cache
   */
  clearCache() {
    return async (_req: Request, res: Response) => {
      await this.cacheManager.clear();

      res.json({
        message: 'Cache cleared',
        timestamp: Date.now(),
      });
    };
  }

  /**
   * Get cache statistics endpoint
   */
  getStats() {
    return (_req: Request, res: Response) => {
      const stats = this.cacheManager.getStats();

      res.json({
        stats,
        timestamp: Date.now(),
      });
    };
  }

  /**
   * Get cache events endpoint
   */
  getEvents() {
    return (req: Request, res: Response) => {
      const limit = Number((req.query.limit as string) ?? 100);
      const events = this.cacheManager.getEventHistory(limit);

      res.json({
        events,
        count: events.length,
      });
    };
  }

  /**
   * Invalidate by pattern endpoint
   */
  invalidatePattern() {
    return async (req: Request, res: Response) => {
      const { pattern } = req.body;

      if (!pattern) {
        res.status(400).json({ error: 'Pattern required' });
        return;
      }

      try {
        const count = await this.cacheManager.invalidatePattern(
          pattern
        );

        res.json({
          pattern,
          invalidated: count,
          timestamp: Date.now(),
        });
      } catch (error) {
        res.status(400).json({
          error: `Invalid pattern: ${error}`,
        });
      }
    };
  }
}
