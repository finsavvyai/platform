/**
 * Caching Middleware for API endpoints
 * Provides intelligent caching for common API patterns
 */

import CacheService from './cache-service.js';

export class CachingMiddleware {
  constructor(env) {
    this.cacheService = new CacheService(env);

    // Predefined caching configurations for different endpoint types
    this.configurations = {
      // RAG query responses - short TTL, high refresh
      ragQuery: {
        ttl: 300, // 5 minutes
        refreshTTL: 240, // 4 minutes
        strategy: 'ttl_refresh',
        tags: ['rag', 'query'],
        priority: 'high'
      },

      // Team analytics - medium TTL, periodic refresh
      analytics: {
        ttl: 1800, // 30 minutes
        strategy: 'ttl',
        tags: ['analytics'],
        priority: 'normal'
      },

      // User sessions - medium TTL
      session: {
        ttl: 900, // 15 minutes
        strategy: 'lru',
        tags: ['session'],
        priority: 'high'
      },

      // Static metadata - long TTL
      metadata: {
        ttl: 3600, // 1 hour
        strategy: 'ttl',
        tags: ['metadata'],
        priority: 'low'
      },

      // Rate limiting - sliding window
      rateLimit: {
        ttl: 60, // 1 minute
        strategy: 'sliding_window',
        tags: ['rate_limit'],
        priority: 'high'
      }
    };
  }

  /**
   * Main caching middleware
   */
  cacheResponse(config = {}) {
    return async (request, env, ctx) => {
      const {
        ttl = 300,
        keyGenerator = this.defaultKeyGenerator,
        shouldCache = this.defaultShouldCache,
        condition = null,
        ...cacheOptions
      } = config;

      try {
        // Check if request should be cached
        if (!shouldCache(request)) {
          return null;
        }

        // Apply additional condition if provided
        if (condition && !condition(request)) {
          return null;
        }

        // Generate cache key
        const cacheKey = this.cacheService.generateCacheKey('query', keyGenerator(request));

        // Try to get from cache
        const cached = await this.cacheService.get(cacheKey, {
          ttl,
          ...cacheOptions
        });

        if (cached && !cached.stale) {
          // Return cached response
          return this.createCachedResponse(cached.data, cached.age);
        }

        return null;
      } catch (error) {
        console.error('Caching middleware error:', error);
        return null; // Fail silently
      }
    };
  }

  /**
   * Post-request caching middleware
   */
  storeResponse(config = {}) {
    return async (response, request, env, ctx) => {
      const {
        ttl = 300,
        keyGenerator = this.defaultKeyGenerator,
        shouldStore = this.defaultShouldStore,
        transformResponse = null,
        ...cacheOptions
      } = config;

      try {
        if (!shouldStore(response, request)) {
          return response;
        }

        const cacheKey = this.cacheService.generateCacheKey('query', keyGenerator(request));

        // Clone response since streams can only be read once
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        // Transform data if needed
        const cacheData = transformResponse ? transformResponse(data) : data;

        // Store in cache
        await this.cacheService.set(cacheKey, cacheData, {
          ttl,
          ...cacheOptions
        });

        // Return original response
        return response;
      } catch (error) {
        console.error('Store response error:', error);
        return response; // Return original response on error
      }
    };
  }

  /**
   * RAG Query specific caching
   */
  cacheRAGQuery() {
    return this.cacheResponse({
      ttl: this.configurations.ragQuery.ttl,
      refreshTTL: this.configurations.ragQuery.refreshTTL,
      strategy: this.configurations.ragQuery.strategy,
      tags: this.configurations.ragQuery.tags,
      keyGenerator: (req) => {
        const url = new URL(req.url);
        const body = req.body ? JSON.stringify(req.body) : '';
        return `rag:${url.pathname}:${this.hashString(body)}`;
      },
      shouldCache: (req) => {
        return req.method === 'POST' &&
               req.url.includes('/query') &&
               !req.url.includes('/team'); // Don't cache team queries
      }
    });
  }

  /**
   * Team Analytics caching
   */
  cacheAnalytics() {
    return this.cacheResponse({
      ttl: this.configurations.analytics.ttl,
      strategy: this.configurations.analytics.strategy,
      tags: this.configurations.analytics.tags,
      keyGenerator: (req) => {
        const url = new URL(req.url);
        const params = url.searchParams.toString();
        return `analytics:${url.pathname}:${params}`;
      },
      shouldCache: (req) => {
        return req.method === 'GET' &&
               req.url.includes('/analytics');
      }
    });
  }

  /**
   * Session caching
   */
  cacheSession() {
    return this.cacheResponse({
      ttl: this.configurations.session.ttl,
      strategy: this.configurations.session.strategy,
      tags: this.configurations.session.tags,
      keyGenerator: (req) => {
        const authHeader = req.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');
        return `session:${this.hashString(token)}`;
      },
      shouldCache: (req) => {
        return req.url.includes('/auth/me') && req.method === 'GET';
      }
    });
  }

  /**
   * Rate limiting middleware
   */
  rateLimit(identifier, limit, window, options = {}) {
    return async (request, env, ctx) => {
      try {
        const rateLimitResult = await this.cacheService.checkRateLimit(
          identifier,
          limit,
          window,
          options
        );

        if (!rateLimitResult.allowed) {
          return new Response(
            JSON.stringify({
              success: false,
              error_code: 'rate_limited',
              message: 'Too many requests',
              retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'X-RateLimit-Limit': limit.toString(),
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
                'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
              }
            }
          );
        }

        // Add rate limit headers to successful responses
        return (response) => {
          response.headers.set('X-RateLimit-Limit', limit.toString());
          response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
          response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
          return response;
        };
      } catch (error) {
        console.error('Rate limiting error:', error);
        return null; // Fail open
      }
    };
  }

  /**
   * Cache invalidation middleware
   */
  invalidateCache(patterns = [], options = {}) {
    return async (request, env, ctx) => {
      const { method, url } = request;

      // Only invalidate on modifying requests
      if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        return;
      }

      try {
        const invalidationPromises = patterns.map(async pattern => {
          if (typeof pattern === 'function') {
            // Dynamic pattern generation
            const dynamicPattern = pattern(request);
            return this.cacheService.invalidate(dynamicPattern, options);
          } else {
            // Static pattern
            return this.cacheService.invalidate(pattern, options);
          }
        });

        await Promise.all(invalidationPromises);
      } catch (error) {
        console.error('Cache invalidation error:', error);
      }
    };
  }

  /**
   * Cache warming for frequently accessed data
   */
  async warmupCache(env) {
    const warmupQueries = [
      {
        key: 'warmup:popular_queries',
        fetcher: async () => {
          // Fetch popular queries from analytics
          return { queries: [], timestamp: Date.now() };
        },
        options: { ttl: 1800, tags: ['warmup', 'popular'] }
      },

      {
        key: 'warmup:team_templates',
        fetcher: async () => {
          // Fetch team templates
          return { templates: [], timestamp: Date.now() };
        },
        options: { ttl: 3600, tags: ['warmup', 'templates'] }
      },

      {
        key: 'warmup:feature_flags',
        fetcher: async () => {
          // Fetch feature flags
          return { flags: {}, timestamp: Date.now() };
        },
        options: { ttl: 900, tags: ['warmup', 'features'] }
      }
    ];

    const result = await this.cacheService.warmCache(warmupQueries);
    console.log('Cache warmup completed:', result);

    return result;
  }

  /**
   * Regional optimization middleware
   */
  optimizeForRegion() {
    return async (request, env, ctx) => {
      try {
        const cacheOptions = await this.cacheService.optimizeForRegion(request);

        // Store regional options in context for later use
        ctx.cacheOptions = cacheOptions;

        return null;
      } catch (error) {
        console.error('Regional optimization error:', error);
        return null;
      }
    };
  }

  /**
   * Default key generator
   */
  defaultKeyGenerator(request) {
    const url = new URL(request.url);
    const method = request.method;
    const body = request.body ? JSON.stringify(request.body) : '';

    // Create cache key from method, URL, and relevant body content
    return `${method}:${url.pathname}:${url.search}:${this.hashString(body)}`;
  }

  /**
   * Default cache condition
   */
  defaultShouldCache(request) {
    const url = new URL(request.url);

    // Only cache GET requests by default
    if (request.method !== 'GET') {
      return false;
    }

    // Don't cache certain endpoints
    const excludePatterns = [
      '/auth/',
      '/upload',
      '/export',
      '/admin',
      '/health'
    ];

    return !excludePatterns.some(pattern => url.pathname.includes(pattern));
  }

  /**
   * Default store condition
   */
  defaultShouldStore(response, request) {
    // Only store successful responses
    if (!response.ok) {
      return false;
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return false;
    }

    // Check response size
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB limit
      return false;
    }

    return true;
  }

  /**
   * Create cached response with appropriate headers
   */
  createCachedResponse(data, age) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'HIT',
        'X-Cache-Age': age.toString(),
        'X-Cache-Status': 'fresh'
      }
    });
  }

  /**
   * Simple string hashing for cache keys
   */
  hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Performance monitoring for cache
   */
  async monitorPerformance() {
    const stats = await this.cacheService.getCacheStats();

    const performance = {
      cacheHitRate: 0,
      averageResponseTime: 0,
      totalRequests: 0,
      cacheMisses: 0
    };

    // Calculate metrics from cache stats
    if (stats.totalEntries > 0) {
      // These would be collected from actual request metrics
      // For now, provide example calculations
      performance.cacheHitRate = Math.min(0.85, stats.totalEntries / 1000); // Example
      performance.totalRequests = stats.totalEntries * 10; // Example
      performance.cacheMisses = performance.totalRequests * (1 - performance.cacheHitRate);
    }

    return {
      ...stats,
      performance,
      status: performance.cacheHitRate >= this.cacheService.cacheHitThreshold ? 'good' : 'needs_improvement'
    };
  }

  /**
   * Cleanup stale cache entries
   */
  async cleanup() {
    try {
      if (!this.cacheService.kvNamespace) {
        return { message: 'KV namespace not available' };
      }

      const list = await this.cacheService.kvNamespace.list({ prefix: 'meta:' });
      const now = Date.now();
      const cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours ago

      let cleanedCount = 0;

      for (const key of list.keys) {
        try {
          const metadata = await this.cacheService.kvNamespace.get(key.name);
          if (metadata) {
            const parsed = JSON.parse(metadata);
            if (parsed.created < cutoffTime) {
              await this.cacheService.kvNamespace.delete(key.name);
              cleanedCount++;
            }
          }
        } catch (error) {
          console.error(`Error cleaning key ${key.name}:`, error);
        }
      }

      return {
        message: 'Cache cleanup completed',
        entriesCleaned: cleanedCount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Cache cleanup error:', error);
      return { error: error.message };
    }
  }
}

export default CachingMiddleware;