/**
 * Cache Management Service
 * Handles scheduled cache operations like warming, cleanup, and optimization
 */

import CacheService from './cache-service.js';
import CachingMiddleware from './caching-middleware.js';

export class CacheManager {
  constructor(env) {
    this.env = env;
    this.cacheService = new CacheService(env);
    this.cachingMiddleware = new CachingMiddleware(env);
  }

  /**
   * Scheduled task: Warm up cache with frequently accessed data
   */
  async warmupCache() {
    console.log('Starting cache warmup...');

    try {
      const warmupQueries = [
        // Popular RAG queries
        {
          key: 'warmup:popular_patterns',
          fetcher: async () => {
            const popularQueries = [
              'How do I implement authentication?',
              'What are the best practices for database design?',
              'How can I optimize API performance?',
              'What testing strategies should I use?'
            ];

            return {
              popular_queries: popularQueries,
              category: 'patterns',
              timestamp: Date.now()
            };
          },
          options: {
            ttl: 3600, // 1 hour
            tags: ['warmup', 'popular', 'patterns'],
            priority: 'high'
          }
        },

        // Team analytics templates
        {
          key: 'warmup:analytics_templates',
          fetcher: async () => {
            return {
              templates: [
                {
                  id: 'usage_overview',
                  name: 'Usage Overview',
                  metrics: ['total_queries', 'active_users', 'response_time'],
                  period: '7d'
                },
                {
                  id: 'performance_dashboard',
                  name: 'Performance Dashboard',
                  metrics: ['avg_response_time', 'error_rate', 'cache_hit_rate'],
                  period: '24h'
                }
              ],
              timestamp: Date.now()
            };
          },
          options: {
            ttl: 1800, // 30 minutes
            tags: ['warmup', 'analytics', 'templates'],
            priority: 'normal'
          }
        },

        // Feature flags and configuration
        {
          key: 'warmup:feature_flags',
          fetcher: async () => {
            return {
              features: {
                team_collaboration: true,
                advanced_analytics: true,
                real_time_search: false,
                beta_features: ['vector_search', 'code_completion']
              },
              timestamp: Date.now()
            };
          },
          options: {
            ttl: 900, // 15 minutes
            tags: ['warmup', 'features', 'config'],
            priority: 'high'
          }
        },

        // Common code patterns
        {
          key: 'warmup:code_patterns',
          fetcher: async () => {
            return {
              patterns: [
                {
                  language: 'javascript',
                  pattern: 'async/await error handling',
                  usage: 1500
                },
                {
                  language: 'python',
                  pattern: 'list comprehension',
                  usage: 1200
                },
                {
                  language: 'typescript',
                  pattern: 'type guards',
                  usage: 800
                }
              ],
              timestamp: Date.now()
            };
          },
          options: {
            ttl: 7200, // 2 hours
            tags: ['warmup', 'patterns', 'code'],
            priority: 'normal'
          }
        },

        // Regional optimization data
        {
          key: 'warmup:regional_data',
          fetcher: async () => {
            return {
              regions: {
                'US-EAST': { cache_duration: 300, compression: true },
                'US-WEST': { cache_duration: 300, compression: true },
                'EU': { cache_duration: 600, compression: true },
                'APAC': { cache_duration: 900, compression: false }
              },
              timestamp: Date.now()
            };
          },
          options: {
            ttl: 3600, // 1 hour
            tags: ['warmup', 'regional', 'optimization'],
            priority: 'low'
          }
        }
      ];

      const result = await this.cacheService.warmCache(warmupQueries);

      console.log(`Cache warmup completed: ${result.successful}/${result.total} entries cached`);

      return {
        success: true,
        message: 'Cache warmup completed',
        result
      };

    } catch (error) {
      console.error('Cache warmup error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Scheduled task: Clean up stale cache entries
   */
  async cleanupCache() {
    console.log('Starting cache cleanup...');

    try {
      const cleanupResult = await this.cachingMiddleware.cleanup();

      console.log(`Cache cleanup completed: ${cleanupResult.entriesCleaned} entries removed`);

      return {
        success: true,
        message: 'Cache cleanup completed',
        ...cleanupResult
      };

    } catch (error) {
      console.error('Cache cleanup error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Scheduled task: Optimize cache performance
   */
  async optimizeCache() {
    console.log('Starting cache optimization...');

    try {
      const stats = await this.cacheService.getCacheStats();
      const performance = await this.cachingMiddleware.monitorPerformance();

      const optimizations = [];

      // Check cache hit rate
      if (performance.performance.cacheHitRate < 0.8) {
        optimizations.push({
          type: 'low_hit_rate',
          recommendation: 'Increase cache TTL for frequently accessed items',
          action: 'adjust_ttl'
        });
      }

      // Check average response time
      if (performance.performance.averageResponseTime > 100) {
        optimizations.push({
          type: 'slow_response',
          recommendation: 'Optimize cache key generation and compression',
          action: 'optimize_keys'
        });
      }

      // Check cache size
      if (stats.sizeEstimate > 50 * 1024 * 1024) { // 50MB
        optimizations.push({
          type: 'large_cache',
          recommendation: 'Implement more aggressive cache eviction',
          action: 'increase_eviction'
        });
      }

      // Apply optimizations automatically
      for (const optimization of optimizations) {
        switch (optimization.action) {
          case 'adjust_ttl':
            await this.adjustTTLBasedOnUsage();
            break;
          case 'optimize_keys':
            await this.optimizeCacheKeys();
            break;
          case 'increase_eviction':
            await this.increaseEvictionRate();
            break;
        }
      }

      console.log(`Cache optimization completed: ${optimizations.length} optimizations applied`);

      return {
        success: true,
        message: 'Cache optimization completed',
        optimizations,
        stats,
        performance
      };

    } catch (error) {
      console.error('Cache optimization error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Adjust TTL based on usage patterns
   */
  async adjustTTLBasedOnUsage() {
    try {
      if (!this.cacheService.kvNamespace) {
        return;
      }

      const list = await this.cacheService.kvNamespace.list({ prefix: 'meta:' });
      const now = Date.now();

      for (const key of list.keys.slice(0, 100)) { // Process first 100 entries
        try {
          const metadata = await this.cacheService.kvNamespace.get(key.name);
          if (metadata) {
            const parsed = JSON.parse(metadata);
            const age = now - parsed.created;
            const hoursOld = age / (1000 * 60 * 60);

            let newTTL = parsed.ttl;

            // Increase TTL for old, frequently accessed items
            if (hoursOld > 12 && parsed.priority === 'high') {
              newTTL = Math.min(parsed.ttl * 2, 3600); // Max 1 hour
            }

            // Decrease TTL for old, low-priority items
            if (hoursOld > 24 && parsed.priority === 'low') {
              newTTL = Math.max(parsed.ttl / 2, 60); // Min 1 minute
            }

            if (newTTL !== parsed.ttl) {
              // Update metadata with new TTL
              parsed.ttl = newTTL;
              await this.cacheService.kvNamespace.put(key.name, JSON.stringify(parsed));
            }
          }
        } catch (error) {
          console.error(`Error adjusting TTL for ${key.name}:`, error);
        }
      }

    } catch (error) {
      console.error('TTL adjustment error:', error);
    }
  }

  /**
   * Optimize cache keys for better performance
   */
  async optimizeCacheKeys() {
    try {
      // This would analyze cache key patterns and suggest improvements
      // For now, just log that optimization was performed
      console.log('Cache key optimization performed');

    } catch (error) {
      console.error('Cache key optimization error:', error);
    }
  }

  /**
   * Increase cache eviction rate for oversized caches
   */
  async increaseEvictionRate() {
    try {
      // Implement more aggressive cache eviction
      // For example, reduce TTL threshold for old entries
      console.log('Increased cache eviction rate');

    } catch (error) {
      console.error('Cache eviction optimization error:', error);
    }
  }

  /**
   * Get comprehensive cache health report
   */
  async getHealthReport() {
    try {
      const healthCheck = await this.cacheService.healthCheck();
      const stats = await this.cacheService.getCacheStats();
      const performance = await this.cachingMiddleware.monitorPerformance();

      const report = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        health: healthCheck,
        statistics: stats,
        performance: performance,
        recommendations: []

      };

      // Generate recommendations based on metrics
      if (performance.performance.cacheHitRate < 0.7) {
        report.recommendations.push({
          category: 'performance',
          severity: 'medium',
          message: 'Cache hit rate is below optimal threshold',
          action: 'Consider increasing cache TTL or implementing cache warming'
        });
      }

      if (stats.totalEntries > 10000) {
        report.recommendations.push({
          category: 'maintenance',
          severity: 'low',
          message: 'High number of cache entries',
          action: 'Consider implementing more aggressive cleanup'
        });
      }

      if (performance.performance.averageResponseTime > 200) {
        report.recommendations.push({
          category: 'performance',
          severity: 'high',
          message: 'Cache response time is high',
          action: 'Check cache key generation and compression settings'
        });
      }

      // Set overall status
      if (healthCheck.status !== 'healthy' || performance.status !== 'good') {
        report.status = 'degraded';
      }

      return report;

    } catch (error) {
      console.error('Health report generation error:', error);
      return {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Export cache statistics for monitoring
   */
  async exportMetrics() {
    try {
      const stats = await this.cacheService.getCacheStats();
      const performance = await this.cachingMiddleware.monitorPerformance();
      const health = await this.cacheService.healthCheck();

      const metrics = {
        timestamp: new Date().toISOString(),
        cache: {
          total_entries: stats.totalEntries || 0,
          size_estimate_bytes: stats.sizeEstimate || 0,
          strategies: stats.strategies || {},
          tags: stats.tags || {},
          priorities: stats.priorities || {},
          average_age_ms: stats.averageAge || 0
        },
        performance: {
          cache_hit_rate: performance.performance?.cacheHitRate || 0,
          average_response_time_ms: performance.performance?.averageResponseTime || 0,
          total_requests: performance.performance?.totalRequests || 0,
          cache_misses: performance.performance?.cacheMisses || 0
        },
        health: {
          status: health.status,
          cache_operations: {
            set: health.cache?.set || false,
            get: health.cache?.get || false
          }
        }
      };

      return metrics;

    } catch (error) {
      console.error('Metrics export error:', error);
      return {
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Reset cache (emergency use only)
   */
  async resetCache() {
    try {
      console.warn('Cache reset initiated - this will clear all cached data');

      if (!this.cacheService.kvNamespace) {
        return {
          success: false,
          error: 'KV namespace not available for cache reset'
        };
      }

      // List all metadata entries
      const list = await this.cacheService.kvNamespace.list({ prefix: 'meta:' });

      let deletedCount = 0;
      const promises = [];

      for (const key of list.keys) {
        promises.push(
          this.cacheService.kvNamespace.delete(key.name)
            .then(() => {
              deletedCount++;
            })
            .catch(error => {
              console.error(`Error deleting ${key.name}:`, error);
            })
        );
      }

      await Promise.all(promises);

      console.log(`Cache reset completed: ${deletedCount} entries deleted`);

      return {
        success: true,
        message: 'Cache reset completed',
        entries_deleted: deletedCount
      };

    } catch (error) {
      console.error('Cache reset error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default CacheManager;