/**
 * Database Optimization API Routes
 *
 * Endpoints for monitoring query performance, connection pool health,
 * and cache statistics. Admin-only access.
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';
import QueryProfiler from './QueryProfiler.js';
import ConnectionPoolOptimizer from './ConnectionPoolOptimizer.js';
import QueryCache from './QueryCache.js';

export function createDBOptimizerRoutes(
  profiler: QueryProfiler,
  poolOptimizer: ConnectionPoolOptimizer,
  queryCache: QueryCache
): Router {
  const router = Router();

  /**
   * Middleware: Admin-only access
   */
  const requireAdmin = (req: Request, res: Response, next: any): void => {
    const user = (req as any).user;
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }
    next();
  };

  router.use(requireAdmin);

  /**
   * GET /api/db/slow-queries
   * List slow queries with aggregated statistics
   */
  router.get('/slow-queries', (_req: Request, res: Response): void => {
    try {
      const threshold = parseInt((_req.query.threshold as string) || '1000');
      const slowQueries = profiler.getSlowQueries(threshold);

      res.json({
        threshold,
        count: slowQueries.length,
        queries: slowQueries.map((q) => ({
          sql: q.sql.substring(0, 200), // Truncate for display
          stats: {
            count: q.count,
            avgDurationMs: q.averageDurationMs,
            maxDurationMs: q.maxDurationMs,
            minDurationMs: q.minDurationMs,
            totalDurationMs: q.totalDurationMs,
          },
          issues: {
            isN1Query: q.isN1Query,
            fullTableScan: q.fullTableScan,
          },
          lastExecutedAt: new Date(q.lastExecutedAt).toISOString(),
        })),
      });
    } catch (error) {
      logger.error('Error getting slow queries:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/db/stats
   * Comprehensive query statistics
   */
  router.get('/stats', (_req: Request, res: Response): void => {
    try {
      const stats = profiler.getQueryStats();

      res.json({
        summary: {
          totalQueries: stats.totalQueries,
          uniqueQueries: stats.uniqueQueries,
          averageDurationMs: stats.averageDurationMs,
          totalDurationMs: stats.totalDurationMs,
        },
        percentiles: {
          p50: stats.p50DurationMs,
          p95: stats.p95DurationMs,
          p99: stats.p99DurationMs,
        },
        issues: {
          slowQueriesCount: stats.slowQueriesCount,
          n1PatternsDetected: stats.n1QueriesDetected,
          fullTableScans: stats.fullTableScans,
        },
        topQueries: stats.topQueries.map((q, i) => ({
          rank: i + 1,
          sql: q.sql.substring(0, 150),
          executionCount: q.count,
          totalDurationMs: q.totalDurationMs,
          averageDurationMs: Math.round(q.totalDurationMs / q.count),
        })),
      });
    } catch (error) {
      logger.error('Error getting query stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/db/pool
   * Connection pool health and metrics
   */
  router.get('/pool', (_req: Request, res: Response): void => {
    try {
      const health = poolOptimizer.getPoolHealth();
      const metrics = poolOptimizer.getMetrics();
      const recommended = poolOptimizer.getRecommendedConfig();

      res.json({
        health: {
          isHealthy: health.isHealthy,
          status: health.isHealthy ? 'healthy' : 'degraded',
        },
        metrics: {
          activeConnections: metrics.activeConnections,
          idleConnections: metrics.idleConnections,
          waitingRequests: metrics.waitingRequests,
          totalPoolSize: metrics.totalSize,
          utilizationPercent: metrics.utilizationPercent,
        },
        performance: {
          avgWaitTimeMs: metrics.avgWaitTimeMs,
          maxWaitTimeMs: metrics.maxWaitTimeMs,
          timeoutCount: metrics.timeoutCount,
          timeoutRate: Math.round(metrics.timeoutRate * 10000) / 10000,
        },
        reliability: {
          createdConnections: metrics.createdConnections,
          failedConnections: metrics.failedConnections,
          failureRate:
            metrics.createdConnections > 0
              ? Math.round((metrics.failedConnections / metrics.createdConnections) * 10000) / 10000
              : 0,
        },
        alerts: health.alerts.map((a) => ({
          severity: a.severity,
          message: a.message,
          suggestedAction: a.suggestedAction,
        })),
        recommendations: {
          poolSize: recommended.max,
          actions: health.recommendations,
        },
      });
    } catch (error) {
      logger.error('Error getting pool health:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/db/suggestions
   * Index and optimization suggestions
   */
  router.get('/suggestions', (_req: Request, res: Response): void => {
    try {
      const suggestions = profiler.suggestIndexes();

      res.json({
        count: suggestions.length,
        suggestions: suggestions.map((s) => ({
          table: s.table,
          columns: s.columns,
          type: s.type,
          estimatedImpact: s.estimatedImpact,
          reason: s.reason,
          affectedQueries: s.frequency,
          estimatedSizeMB: s.estimatedSizeMB,
          createStatement: s.createStatement,
        })),
      });
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/db/cache
   * Query cache statistics
   */
  router.get('/cache', (_req: Request, res: Response): void => {
    try {
      const stats = queryCache.getStats();

      res.json({
        size: {
          current: stats.size,
          maximum: stats.maxSize,
          utilizationPercent: Math.round((stats.size / stats.maxSize) * 100),
        },
        performance: {
          hits: stats.hits,
          misses: stats.misses,
          totalRequests: stats.hits + stats.misses,
          hitRate: Math.round(stats.hitRate * 10000) / 10000,
        },
        evictions: stats.evictions,
        topEntries: stats.topKeys.map((k, i) => ({
          rank: i + 1,
          key: k.key.substring(0, 100),
          hits: k.hits,
          expiresInSeconds: Math.round(k.expiresIn / 1000),
        })),
      });
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/db/cache/invalidate
   * Invalidate cache by key or table
   */
  router.post('/cache/invalidate', (req: Request, res: Response): void => {
    try {
      const { key, table, pattern } = req.body as {
        key?: string;
        table?: string;
        pattern?: string;
      };

      if (key) {
        queryCache.invalidateQuery(key);
        res.json({ success: true, message: `Invalidated key: ${key}` });
      } else if (table) {
        queryCache.invalidateByTable(table);
        res.json({ success: true, message: `Invalidated table: ${table}` });
      } else if (pattern) {
        queryCache.invalidateByPattern(new RegExp(pattern));
        res.json({ success: true, message: `Invalidated pattern: ${pattern}` });
      } else {
        res.status(400).json({ error: 'Provide key, table, or pattern' });
      }
    } catch (error) {
      logger.error('Error invalidating cache:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/db/cache/clear
   * Clear entire cache
   */
  router.post('/cache/clear', (_req: Request, res: Response): void => {
    try {
      queryCache.clear();
      res.json({ success: true, message: 'Cache cleared' });
    } catch (error) {
      logger.error('Error clearing cache:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/db/profiler/reset
   * Reset query profiler data
   */
  router.post('/profiler/reset', (_req: Request, res: Response): void => {
    try {
      profiler.reset();
      res.json({ success: true, message: 'Query profiler reset' });
    } catch (error) {
      logger.error('Error resetting profiler:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

// Default export with default instances
const defaultDBRouter = createDBOptimizerRoutes(
  new QueryProfiler(1000),
  new ConnectionPoolOptimizer(),
  new QueryCache()
);
export default defaultDBRouter;
