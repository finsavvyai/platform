/**
 * Edge Caching Service for Cloudflare Workers
 * Implements intelligent caching strategies for global edge performance
 */

export class CacheService {
  constructor(env) {
    this.cache = env?.CACHE || caches.default;
    this.kvNamespace = env?.CACHE_KV || null;
    this.environment = env?.ENVIRONMENT || 'development';

    // Cache configuration
    this.defaultTTL = 300; // 5 minutes
    this.maxCacheSize = 100; // MB
    this.cacheHitThreshold = 0.8; // 80% target

    // Cache key prefixes
    this.prefixes = {
      query: 'query:',
      rag: 'rag:',
      embedding: 'embedding:',
      metadata: 'metadata:',
      rate_limit: 'rate_limit:',
      session: 'session:',
      analytics: 'analytics:'
    };

    // Cache strategies
    this.strategies = {
      // Time-based expiration
      TTL: 'ttl',

      // Least Recently Used
      LRU: 'lru',

      // Time-to-live with refresh
      TTL_REFRESH: 'ttl_refresh',

      // Write-through caching
      WRITE_THROUGH: 'write_through',

      // Cache-aside pattern
      CACHE_ASIDE: 'cache_aside'
    };
  }

  /**
   * Generate cache key with namespace and metadata
   */
  generateCacheKey(type, identifier, metadata = {}) {
    const prefix = this.prefixes[type] || 'default:';
    const metaString = Object.entries(metadata)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    return `${prefix}${identifier}${metaString ? `?${metaString}` : ''}`;
  }

  /**
   * Get cached response with intelligent refresh
   */
  async get(key, options = {}) {
    try {
      const {
        strategy = this.strategies.CACHE_ASIDE,
        ttl = this.defaultTTL,
        refreshTTL = ttl * 0.8,
        validator = null
      } = options;

      // Try cache first
      const cached = await this.cache.get(key);

      if (cached) {
        const data = JSON.parse(cached);

        // Check if cache is stale for refresh strategies
        if (strategy === this.strategies.TTL_REFRESH) {
          const age = Date.now() - data.timestamp;
          const ageSeconds = age / 1000;

          if (ageSeconds > refreshTTL && !data.refreshing) {
            // Mark as refreshing to avoid thundering herd
            data.refreshing = true;
            await this.cache.put(key, JSON.stringify(data), { ttl });

            // Return stale data but indicate refresh needed
            return {
              data: data.value,
              stale: true,
              needsRefresh: true
            };
          }
        }

        // Validate cached data if validator provided
        if (validator && !validator(data.value)) {
          await this.cache.delete(key);
          return null;
        }

        return {
          data: data.value,
          stale: false,
          needsRefresh: false,
          age: Date.now() - data.timestamp
        };
      }

      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Store response in cache with metadata
   */
  async set(key, value, options = {}) {
    try {
      const {
        ttl = this.defaultTTL,
        strategy = this.strategies.CACHE_ASIDE,
        tags = [],
        priority = 'normal',
        compress = true
      } = options;

      const cacheEntry = {
        value,
        timestamp: Date.now(),
        ttl,
        strategy,
        tags,
        priority,
        version: '1.0'
      };

      // Cloudflare Workers cache automatically handles TTL
      const cacheOptions = {
        ttl: ttl,
        headers: {
          'Cache-Control': `public, max-age=${ttl}`,
          'X-Cache-Strategy': strategy,
          'X-Cache-Priority': priority,
          'Content-Type': 'application/json'
        }
      };

      await this.cache.put(key, JSON.stringify(cacheEntry), cacheOptions);

      // Also store in KV for persistent metadata
      if (this.kvNamespace) {
        const metadata = {
          key,
          strategy,
          ttl,
          tags,
          priority,
          created: cacheEntry.timestamp
        };

        await this.kvNamespace.put(
          `meta:${key}`,
          JSON.stringify(metadata),
          { expirationTtl: ttl * 2 } // Keep metadata longer
        );
      }

      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Cache invalidation with pattern matching
   */
  async invalidate(pattern, options = {}) {
    try {
      const {
        tags = [],
        exactMatch = false
      } = options;

      let keysToDelete = [];

      if (exactMatch) {
        keysToDelete = [pattern];
      } else {
        // Pattern matching for cache invalidation
        // In production, this would use a cache management API
        if (this.kvNamespace) {
          const list = await this.kvNamespace.list({
            prefix: pattern.replace(/\*$/, '')
          });

          keysToDelete = list.keys
            .filter(key => key.name.startsWith('meta:'))
            .map(key => key.name.replace('meta:', ''));
        }
      }

      // Delete from cache and KV
      const promises = keysToDelete.map(key =>
        Promise.all([
          this.cache.delete(key),
          this.kvNamespace?.delete(`meta:${key}`)
        ]).catch(() => {}) // Ignore errors during deletion
      );

      await Promise.all(promises);

      return keysToDelete.length;
    } catch (error) {
      console.error('Cache invalidate error:', error);
      return 0;
    }
  }

  /**
   * Intelligent cache warming for frequently accessed data
   */
  async warmCache(warmupQueries = []) {
    try {
      const results = [];

      for (const query of warmupQueries) {
        const {
          key,
          fetcher,
          options = {}
        } = query;

        // Check if already cached
        const cached = await this.get(key);
        if (cached && !cached.stale) {
          continue;
        }

        // Fetch and cache
        try {
          const data = await fetcher();
          await this.set(key, data, {
            ...options,
            priority: 'high'
          });

          results.push({ key, success: true });
        } catch (error) {
          results.push({ key, success: false, error: error.message });
        }
      }

      return {
        total: warmupQueries.length,
        successful: results.filter(r => r.success).length,
        results
      };
    } catch (error) {
      console.error('Cache warming error:', error);
      return { total: 0, successful: 0, error: error.message };
    }
  }

  /**
   * Get cache statistics and performance metrics
   */
  async getCacheStats() {
    try {
      if (!this.kvNamespace) {
        return { error: 'KV namespace not available' };
      }

      const list = await this.kvNamespace.list({ prefix: 'meta:' });
      const metadata = await Promise.all(
        list.keys.map(key =>
          this.kvNamespace.get(key.name)
            .then(value => ({ key: key.name, metadata: JSON.parse(value) }))
            .catch(() => null)
        )
      );

      const validMetadata = metadata.filter(Boolean);

      const stats = {
        totalEntries: validMetadata.length,
        strategies: {},
        tags: {},
        priorities: {},
        averageAge: 0,
        sizeEstimate: 0
      };

      let totalAge = 0;
      const now = Date.now();

      validMetadata.forEach(item => {
        const { metadata: meta } = item;

        // Strategy distribution
        stats.strategies[meta.strategy] = (stats.strategies[meta.strategy] || 0) + 1;

        // Tag distribution
        meta.tags?.forEach(tag => {
          stats.tags[tag] = (stats.tags[tag] || 0) + 1;
        });

        // Priority distribution
        stats.priorities[meta.priority] = (stats.priorities[meta.priority] || 0) + 1;

        // Age calculation
        const age = now - meta.created;
        totalAge += age;
      });

      stats.averageAge = validMetadata.length > 0 ? totalAge / validMetadata.length : 0;
      stats.sizeEstimate = validMetadata.length * 1024; // Rough estimate

      return stats;
    } catch (error) {
      console.error('Cache stats error:', error);
      return { error: error.message };
    }
  }

  /**
   * Adaptive TTL based on access patterns
   */
  calculateAdaptiveTTL(key, accessCount, lastAccess, baseTTL = this.defaultTTL) {
    const now = Date.now();
    const timeSinceAccess = now - lastAccess;
    const hoursSinceAccess = timeSinceAccess / (1000 * 60 * 60);

    // Increase TTL for frequently accessed items
    let multiplier = 1;

    if (accessCount > 100) {
      multiplier = 3; // Very popular
    } else if (accessCount > 50) {
      multiplier = 2; // Popular
    } else if (accessCount > 10) {
      multiplier = 1.5; // Moderately popular
    }

    // Decrease TTL for old items
    if (hoursSinceAccess > 24) {
      multiplier *= 0.5;
    } else if (hoursSinceAccess > 12) {
      multiplier *= 0.75;
    }

    const adaptiveTTL = Math.max(
      Math.floor(baseTTL * multiplier),
      60 // Minimum 1 minute
    );

    return Math.min(adaptiveTTL, 3600); // Maximum 1 hour
  }

  /**
   * Rate limiting with sliding window
   */
  async checkRateLimit(identifier, limit, window, options = {}) {
    try {
      const {
        burst = limit * 2,
        penalty = 0,
        tags = ['rate_limit']
      } = options;

      const key = this.generateCacheKey('rate_limit', identifier, {
        window: window.toString()
      });

      const now = Date.now();
      const windowStart = now - (window * 1000);

      // Get current rate limit data
      const cached = await this.get(key);
      let requests = cached ? cached.data.requests : [];

      // Clean old requests
      requests = requests.filter(timestamp => timestamp > windowStart);

      // Check if limit exceeded
      const withinLimit = requests.length < limit;

      if (withinLimit) {
        requests.push(now);

        await this.set(key, { requests }, {
          ttl: window,
          tags,
          strategy: this.strategies.LRU
        });
      } else {
        // Apply penalty if specified
        if (penalty > 0) {
          await this.set(key, {
            requests: [...requests, now, ...Array(penalty).fill(now)]
          }, {
            ttl: window + penalty,
            tags: [...tags, 'penalty']
          });
        }
      }

      return {
        allowed: withinLimit,
        remaining: Math.max(0, limit - requests.length),
        resetTime: windowStart + (window * 1000),
        requestsInWindow: requests.length,
        burstRemaining: Math.max(0, burst - requests.length)
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + (window * 1000),
        error: error.message
      };
    }
  }

  /**
   * Regional cache optimization
   */
  async optimizeForRegion(request, region = 'global') {
    try {
      const { headers } = request;

      // Get client location from Cloudflare headers
      const country = headers.get('cf-ipcountry');
      const colo = headers.get('cf-colo'); // Data center code
      const timezone = headers.get('cf-timezone');

      const regionData = {
        country,
        colo,
        timezone,
        cacheRegion: region
      };

      // Adjust cache behavior based on region
      const cacheOptions = {
        tags: [`region:${country || 'unknown'}`, `colo:${colo || 'unknown'}`]
      };

      // Longer cache for regions with high latency
      const highLatencyRegions = ['AP', 'AF', 'SA'];
      if (highLatencyRegions.includes(country?.substring(0, 2))) {
        cacheOptions.ttl = this.defaultTTL * 2;
      }

      // Different cache keys for different regions if needed
      if (region === 'local') {
        const regionalKey = `${country}-${colo}`;
        return {
          ...cacheOptions,
          regionalKey,
          shouldRegionalize: true
        };
      }

      return cacheOptions;
    } catch (error) {
      console.error('Regional optimization error:', error);
      return {};
    }
  }

  /**
   * Cache middleware for requests
   */
  createCacheMiddleware(options = {}) {
    const {
      keyGenerator = (req) => req.url,
      ttl = this.defaultTTL,
      strategies = [this.strategies.CACHE_ASIDE],
      shouldCache = (req) => req.method === 'GET',
      invalidateOn = ['POST', 'PUT', 'DELETE']
    } = options;

    return async (request, env, ctx) => {
      try {
        // Check if request should be cached
        if (!shouldCache(request)) {
          return null; // Skip cache
        }

        const cacheKey = this.generateCacheKey('query', keyGenerator(request));

        // Try cache first
        const cached = await this.get(cacheKey);

        if (cached && !cached.stale) {
          return new Response(JSON.stringify(cached.data), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Cache': 'HIT',
              'X-Cache-Age': cached.age.toString()
            }
          });
        }

        // Cache miss - return null to let request proceed
        return null;
      } catch (error) {
        console.error('Cache middleware error:', error);
        return null; // Fail silently
      }
    };
  }

  /**
   * Batch operations for cache efficiency
   */
  async batchGet(keys, options = {}) {
    const results = await Promise.allSettled(
      keys.map(key => this.get(key, options))
    );

    return results.map((result, index) => ({
      key: keys[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  }

  async batchSet(entries, options = {}) {
    const results = await Promise.allSettled(
      entries.map(({ key, value }) => this.set(key, value, options))
    );

    return results.map((result, index) => ({
      key: entries[index].key,
      success: result.status === 'fulfilled',
      error: result.status === 'rejected' ? result.reason : null
    }));
  }

  /**
   * Health check for cache service
   */
  async healthCheck() {
    try {
      const testKey = 'health-check-test';
      const testValue = { timestamp: Date.now() };

      // Test set
      const setSuccess = await this.set(testKey, testValue, { ttl: 10 });

      // Test get
      const getResult = await this.get(testKey);
      const getSuccess = getResult && getResult.data.timestamp === testValue.timestamp;

      // Test delete
      await this.cache.delete(testKey);

      // Cache stats
      const stats = await this.getCacheStats();

      return {
        status: 'healthy',
        cache: {
          set: setSuccess,
          get: getSuccess,
          stats
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default CacheService;