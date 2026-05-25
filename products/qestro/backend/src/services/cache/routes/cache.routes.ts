/**
 * Cache API Routes
 * Endpoints for cache management and statistics
 */

import { Router, Request, Response } from 'express';
import { CacheManager } from '../CacheManager.js';
import { CacheMiddleware } from '../CacheMiddleware.js';

export function createCacheRoutes(
  cacheManager: CacheManager,
  cacheMiddleware: CacheMiddleware
): Router {
  const router = Router();

  /**
   * GET /api/cache/stats - Get cache statistics
   */
  router.get('/stats', (req: Request, res: Response) => {
    const stats = cacheManager.getStats();

    res.json({
      stats,
      timestamp: Date.now(),
      info: {
        hitRatePercent: (stats.hitRate * 100).toFixed(2),
        totalRequests: stats.hitsL1 + stats.hitsL2 + stats.misses,
        l1Efficiency: (
          (stats.hitsL1 / (stats.hitsL1 + stats.hitsL2 + stats.misses)) *
          100
        ).toFixed(2),
      },
    });
  });

  /**
   * GET /api/cache/events - Get cache event history
   */
  router.get('/events', (req: Request, res: Response) => {
    const limit = Number((req.query.limit as string) ?? 100);
    const events = cacheManager.getEventHistory(limit);

    const summary = {
      hits: events.filter((e) => e.type === 'hit').length,
      misses: events.filter((e) => e.type === 'miss').length,
      sets: events.filter((e) => e.type === 'set').length,
      deletes: events.filter((e) => e.type === 'delete').length,
      evicts: events.filter((e) => e.type === 'evict').length,
    };

    res.json({
      events: events.slice(-limit),
      summary,
      count: events.length,
    });
  });

  /**
   * POST /api/cache/invalidate - Invalidate by pattern
   */
  router.post('/invalidate', async (req: Request, res: Response) => {
    const { pattern } = req.body;

    if (!pattern || typeof pattern !== 'string') {
      res.status(400).json({
        error: 'Pattern required (string)',
      });
      return;
    }

    try {
      const count = await cacheManager.invalidatePattern(pattern);

      res.json({
        pattern,
        invalidated: count,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(400).json({
        error: `Invalid pattern: ${error instanceof Error ? error.message : 'unknown'}`,
      });
    }
  });

  /**
   * POST /api/cache/flush - Flush all caches
   */
  router.post('/flush', async (_req: Request, res: Response) => {
    await cacheManager.clear();

    res.json({
      message: 'All caches flushed',
      timestamp: Date.now(),
    });
  });

  /**
   * GET /api/cache/keys - List cached keys
   */
  router.get('/keys', (_req: Request, res: Response) => {
    const stats = cacheManager.getStats();

    res.json({
      message: 'Cache keys not directly accessible for privacy',
      entriesL1: stats.entriesL1,
      entriesL2: stats.entriesL2,
      totalSize: stats.totalSize,
      info: 'Use /stats endpoint for detailed cache statistics',
    });
  });

  /**
   * GET /api/cache/health - Cache health check
   */
  router.get('/health', (_req: Request, res: Response) => {
    const stats = cacheManager.getStats();
    const isHealthy = stats.hitRate > 0.5;

    res.json({
      healthy: isHealthy,
      hitRate: (stats.hitRate * 100).toFixed(2),
      totalSize: stats.totalSize,
      entries: stats.entriesL1 + stats.entriesL2,
      status: isHealthy ? 'good' : 'needs-warmup',
    });
  });

  return router;
}

const defaultCacheRouter = createCacheRoutes(new CacheManager(), new CacheMiddleware(new CacheManager()));
export default defaultCacheRouter;
