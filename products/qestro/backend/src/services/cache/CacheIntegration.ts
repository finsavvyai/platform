/**
 * CacheIntegration: Factory and setup for Cache system
 * Initializes multi-tier cache with default configuration
 */

import { CacheManager } from './CacheManager.js';
import { CacheMiddleware } from './CacheMiddleware.js';
import { createCacheRoutes } from './routes/cache.routes.js';
import { Express } from 'express';

export class CacheIntegration {
  static cacheManager: CacheManager;
  static cacheMiddleware: CacheMiddleware;

  /**
   * Initialize cache system
   */
  static initialize() {
    this.cacheManager = new CacheManager({
      maxSizeBytes: 100 * 1024 * 1024, // 100MB
      maxEntriesL1: 10000,
      evictionPolicy: 'lru',
      defaultTtlSeconds: 3600,
      enableL2: process.env.REDIS_ENABLED === 'true',
      l2Host: process.env.REDIS_HOST ?? 'localhost',
      l2Port: parseInt(process.env.REDIS_PORT ?? '6379'),
      l2Db: parseInt(process.env.REDIS_DB ?? '0'),
    });

    this.cacheMiddleware = new CacheMiddleware(this.cacheManager);

    return {
      cacheManager: this.cacheManager,
      cacheMiddleware: this.cacheMiddleware,
    };
  }

  /**
   * Register cache routes in Express app
   */
  static registerRoutes(app: Express) {
    const cacheRoutes = createCacheRoutes(
      this.cacheManager,
      this.cacheMiddleware
    );

    app.use('/api/cache', cacheRoutes);
  }

  /**
   * Create cached response middleware
   */
  static cacheResponse(ttlSeconds: number = 3600) {
    return this.cacheMiddleware.cacheResponse(ttlSeconds);
  }

  /**
   * Create mutation invalidation middleware
   */
  static invalidateOnMutation(patterns: string[] = []) {
    return this.cacheMiddleware.invalidateOnMutation(patterns);
  }

  /**
   * Get cache manager instance
   */
  static getManager(): CacheManager {
    return this.cacheManager;
  }

  /**
   * Get cache stats
   */
  static getStats() {
    return this.cacheManager.getStats();
  }

  /**
   * Clear all caches
   */
  static async clear() {
    return this.cacheManager.clear();
  }
}
