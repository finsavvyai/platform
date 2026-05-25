/**
 * Performance Optimization Routes
 * API endpoints for caching, monitoring, and database optimization
 */

import express from 'express';
import { cacheService } from '../services/CacheService.js';
import { cdnService } from '../services/CDNService.js';
import { dbOptimizationService } from '../services/DatabaseOptimizationService.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Cache Management Routes
 */

// Get cache statistics
router.get('/cache/stats', authenticateToken, async (req, res) => {
  try {
    const metrics = cacheService.getMetrics();
    const redisInfo = await cacheService.getRedisInfo();

    res.json({
      success: true,
      metrics,
      redis: redisInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

// Cache health check
router.get('/cache/health', async (req, res) => {
  try {
    const health = await cacheService.healthCheck();
    const status = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    res.status(status).json({
      success: health.status !== 'unhealthy',
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      latency: -1,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Clear cache
router.post('/cache/clear', authenticateToken, async (req, res) => {
  try {
    const { pattern } = req.body;
    let success = false;

    if (pattern) {
      // Clear cache by pattern (would need implementation)
      success = await cacheService.clear();
    } else {
      // Clear all cache
      success = await cacheService.clear();
    }

    if (success) {
      res.json({ success: true, message: 'Cache cleared successfully' });
    } else {
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  } catch (error) {
    logger.error('Failed to clear cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Invalidate cache by tag
router.post('/cache/invalidate/:tag', authenticateToken, async (req, res) => {
  try {
    const { tag } = req.params;
    const deletedCount = await cacheService.invalidateByTag(tag);

    res.json({
      success: true,
      deletedCount,
      message: `Invalidated ${deletedCount} cache entries for tag: ${tag}`,
    });
  } catch (error) {
    logger.error(`Failed to invalidate cache by tag ${req.params.tag}:`, error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

/**
 * CDN Management Routes
 */

// Get CDN statistics
router.get('/cdn/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await cdnService.getStats();
    const health = await cdnService.healthCheck();

    res.json({
      success: true,
      stats,
      health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get CDN stats:', error);
    res.status(500).json({ error: 'Failed to get CDN statistics' });
  }
});

// Purge CDN cache
router.post('/cdn/purge', authenticateToken, async (req, res) => {
  try {
    const { urls, patterns, tags, purgeAll } = req.body;

    const purgeRequest: any = {};
    if (urls) purgeRequest.urls = urls;
    if (patterns) purgeRequest.patterns = patterns;
    if (tags) purgeRequest.tags = tags;
    if (purgeAll) purgeRequest.purgeEverything = true;

    const success = await cdnService.purgeCache(purgeRequest);

    if (success) {
      res.json({ success: true, message: 'CDN cache purge initiated successfully' });
    } else {
      res.status(500).json({ error: 'Failed to purge CDN cache' });
    }
  } catch (error) {
    logger.error('Failed to purge CDN cache:', error);
    res.status(500).json({ error: 'Failed to purge CDN cache' });
  }
});

// Get CDN cache rules
router.get('/cdn/rules', authenticateToken, async (req, res) => {
  try {
    const rules = await cdnService.getCacheRules();

    res.json({
      success: true,
      rules,
      count: rules.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get CDN rules:', error);
    res.status(500).json({ error: 'Failed to get CDN cache rules' });
  }
});

// Create CDN cache rule
router.post('/cdn/rules', authenticateToken, async (req, res) => {
  try {
    const { pattern, ttl, edgeTTL, browserTTL, compression, bypassCache } = req.body;

    const rule = {
      pattern,
      ttl,
      edgeTTL,
      browserTTL,
      compression,
      bypassCache,
    };

    const success = await cdnService.createCacheRule(rule);

    if (success) {
      res.json({ success: true, message: 'CDN cache rule created successfully' });
    } else {
      res.status(500).json({ error: 'Failed to create CDN cache rule' });
    }
  } catch (error) {
    logger.error('Failed to create CDN rule:', error);
    res.status(500).json({ error: 'Failed to create CDN cache rule' });
  }
});

/**
 * Database Optimization Routes
 */

// Get table statistics
router.get('/database/stats', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.query;
    const stats = await dbOptimizationService.getTableStats(tableName as string);

    res.json({
      success: true,
      stats,
      count: stats.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get database stats:', error);
    res.status(500).json({ error: 'Failed to get database statistics' });
  }
});

// Get index recommendations
router.get('/database/index-recommendations', authenticateToken, async (req, res) => {
  try {
    const recommendations = await dbOptimizationService.getIndexRecommendations();

    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get index recommendations:', error);
    res.status(500).json({ error: 'Failed to get index recommendations' });
  }
});

// Analyze query
router.post('/database/explain', authenticateToken, async (req, res) => {
  try {
    const { query, params } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const analysis = await dbOptimizationService.explainQuery(query, params);

    res.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to analyze query:', error);
    res.status(500).json({ error: 'Failed to analyze query' });
  }
});

// Create index
router.post('/database/indexes', authenticateToken, async (req, res) => {
  try {
    const { tableName, columns, indexType } = req.body;

    if (!tableName || !columns || !Array.isArray(columns)) {
      return res.status(400).json({ error: 'Table name and columns array are required' });
    }

    const success = await dbOptimizationService.createIndex(tableName, columns, indexType);

    if (success) {
      res.json({ success: true, message: 'Index created successfully' });
    } else {
      res.status(500).json({ error: 'Failed to create index' });
    }
  } catch (error) {
    logger.error('Failed to create index:', error);
    res.status(500).json({ error: 'Failed to create index' });
  }
});

// Vacuum and analyze table
router.post('/database/vacuum/:tableName', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    const { full, analyze, verbose } = req.body;

    const success = await dbOptimizationService.vacuumAnalyze(tableName, {
      full,
      analyze,
      verbose,
    });

    if (success) {
      res.json({ success: true, message: `Vacuum/analyze completed for table ${tableName}` });
    } else {
      res.status(500).json({ error: 'Failed to vacuum/analyze table' });
    }
  } catch (error) {
    logger.error(`Failed to vacuum table ${req.params.tableName}:`, error);
    res.status(500).json({ error: 'Failed to vacuum/analyze table' });
  }
});

// Get query metrics summary
router.get('/database/query-metrics', authenticateToken, async (req, res) => {
  try {
    const summary = dbOptimizationService.getQueryMetricsSummary();

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get query metrics:', error);
    res.status(500).json({ error: 'Failed to get query metrics' });
  }
});

// Clear query metrics
router.post('/database/clear-metrics', authenticateToken, async (req, res) => {
  try {
    dbOptimizationService.clearMetrics();

    res.json({ success: true, message: 'Query metrics cleared successfully' });
  } catch (error) {
    logger.error('Failed to clear query metrics:', error);
    res.status(500).json({ error: 'Failed to clear query metrics' });
  }
});

/**
 * Comprehensive Performance Dashboard
 */

// Get performance overview
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const [
      cacheMetrics,
      cacheHealth,
      cdnStats,
      cdnHealth,
      dbStats,
      queryMetrics,
      indexRecommendations,
    ] = await Promise.all([
      cacheService.getMetrics(),
      cacheService.healthCheck(),
      cdnService.getStats(),
      cdnService.healthCheck(),
      dbOptimizationService.getTableStats(),
      Promise.resolve(dbOptimizationService.getQueryMetricsSummary()),
      dbOptimizationService.getIndexRecommendations(),
    ]);

    const overview = {
      cache: {
        metrics: cacheMetrics,
        health: cacheHealth,
        status: cacheHealth.status,
      },
      cdn: {
        stats: cdnStats,
        health: cdnHealth,
        status: cdnHealth.status,
      },
      database: {
        tableStats: dbStats,
        queryMetrics,
        indexRecommendations: indexRecommendations.slice(0, 5), // Top 5 recommendations
        tableCount: dbStats.length,
      },
      overall: {
        status: cacheHealth.status === 'healthy' && cdnHealth.status === 'healthy' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
      },
    };

    res.json({
      success: true,
      overview,
    });
  } catch (error) {
    logger.error('Failed to get performance overview:', error);
    res.status(500).json({ error: 'Failed to get performance overview' });
  }
});

/**
 * Performance Optimization Tasks
 */

// Run optimization tasks
router.post('/optimize', authenticateToken, async (req, res) => {
  try {
    const { tasks } = req.body;
    const results: any = {};

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Tasks array is required' });
    }

    for (const task of tasks) {
      switch (task) {
        case 'setup-cdn-rules':
          results.cdnRules = await cdnService.setupDefaultRules();
          break;

        case 'vacuum-analyze':
          const tables = await dbOptimizationService.getTableStats();
          const vacuumResults = [];
          for (const table of tables.slice(0, 5)) { // Limit to top 5 tables
            const success = await dbOptimizationService.vacuumAnalyze(table.tableName);
            vacuumResults.push({ table: table.tableName, success });
          }
          results.vacuumAnalyze = vacuumResults;
          break;

        case 'create-indexes':
          const recommendations = await dbOptimizationService.getIndexRecommendations();
          const indexResults = [];
          for (const rec of recommendations.slice(0, 3)) { // Top 3 recommendations
            if (rec.columns.length > 0) {
              const success = await dbOptimizationService.createIndex(
                rec.tableName,
                rec.columns,
                rec.indexType
              );
              indexResults.push({ table: rec.tableName, success });
            }
          }
          results.createIndexes = indexResults;
          break;

        case 'clear-cache':
          results.clearCache = await cacheService.clear();
          break;

        case 'purge-cdn':
          results.purgeCdn = await cdnService.purgeAll();
          break;

        default:
          results[task] = { error: 'Unknown optimization task' };
      }
    }

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to run optimization tasks:', error);
    res.status(500).json({ error: 'Failed to run optimization tasks' });
  }
});

/**
 * Performance Health Check
 */

// Comprehensive health check
router.get('/health-check', async (req, res) => {
  try {
    const [cacheHealth, cdnHealth, redisInfo] = await Promise.all([
      cacheService.healthCheck(),
      cdnService.healthCheck(),
      cacheService.getRedisInfo(),
    ]);

    const overallStatus = cacheHealth.status === 'healthy' && cdnHealth.status === 'healthy' ? 'healthy' : 'degraded';

    const healthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        cache: {
          status: cacheHealth.status,
          latency: cacheHealth.latency,
          error: cacheHealth.error,
        },
        cdn: {
          status: cdnHealth.status,
          latency: cdnHealth.latency,
        },
        redis: {
          status: redisInfo ? 'connected' : 'disconnected',
          memory: redisInfo?.memory?.used_memory_human || 'unknown',
        },
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: overallStatus === 'healthy' || overallStatus === 'degraded',
      healthCheck,
    });
  } catch (error) {
    logger.error('Performance health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;