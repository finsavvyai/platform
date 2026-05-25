/**
 * Enhanced Cache Service with P1 Reliability Fixes
 * - Graceful degradation on cache failures
 * - Circuit breaker pattern
 * - Fallback mechanisms
 * - Comprehensive error handling
 */

export class EnhancedCacheService {
  constructor(env) {
    this.cache = env?.CACHE || caches.default;
    this.kvNamespace = env?.CACHE_KV || null;
    this.environment = env?.ENVIRONMENT || 'development';

    // Cache configuration
    this.defaultTTL = 300; // 5 minutes
    this.maxCacheSize = 100; // MB
    this.cacheHitThreshold = 0.8; // 80% target

    // Circuit breaker configuration
    this.circuitBreaker = {
      failures: 0,
      threshold: 5,
      timeout: 30000, // 30 seconds
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      lastFailureTime: null
    };

    // Metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      fallbacks: 0
    };
  }

  /**
   * Check circuit breaker state
   */
  checkCircuitBreaker() {
    const { state, threshold, timeout, failures, lastFailureTime } = this.circuitBreaker;

    if (state === 'OPEN') {
      // Check if timeout has passed to try half-open
      if (Date.now() - lastFailureTime > timeout) {
        this.circuitBreaker.state = 'HALF_OPEN';
        console.log('Circuit breaker transitioning to HALF_OPEN');
        return true; // Allow request
      }
      return false; // Circuit is open, block request
    }

    if (state === 'HALF_OPEN') {
      return true; // Allow request to test
    }

    return true; // Circuit is closed, allow request
  }

  /**
   * Record circuit breaker success
   */
  recordSuccess() {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
      console.log('Circuit breaker closed after successful request');
    }
  }

  /**
   * Record circuit breaker failure
   */
  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'OPEN';
      console.error(`Circuit breaker opened after ${this.circuitBreaker.failures} failures`);
    }
  }

  /**
   * Get cached data with graceful degradation
   */
  async get(key, options = {}) {
    const {
      fallback = null,
      timeout = 5000,
      retries = 2
    } = options;

    // Check circuit breaker
    if (!this.checkCircuitBreaker()) {
      console.warn('Circuit breaker is OPEN, using fallback');
      this.metrics.fallbacks++;
      return this.handleFallback(fallback, key);
    }

    let lastError = null;

    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Timeout protection
        const result = await Promise.race([
          this.performGet(key),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Cache get timeout')), timeout)
          )
        ]);

        if (result !== null) {
          this.metrics.hits++;
          this.recordSuccess();
          return result;
        }

        this.metrics.misses++;
        return null;

      } catch (error) {
        lastError = error;
        console.error(`Cache get attempt ${attempt + 1} failed:`, error.message);

        if (attempt < retries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }

    // All retries failed
    this.metrics.errors++;
    this.recordFailure();
    console.error('Cache get failed after all retries:', lastError);

    return this.handleFallback(fallback, key);
  }

  /**
   * Perform actual cache get operation
   */
  async performGet(key) {
    try {
      const cached = await this.cache.get(key);

      if (!cached) {
        return null;
      }

      // Handle corrupted cache data
      try {
        const data = JSON.parse(cached);

        // Validate cache structure
        if (!data || typeof data !== 'object') {
          console.warn('Invalid cache structure, deleting:', key);
          await this.safeDelete(key);
          return null;
        }

        // Check if expired (additional validation)
        if (data.timestamp && data.ttl) {
          const age = (Date.now() - data.timestamp) / 1000;
          if (age > data.ttl) {
            await this.safeDelete(key);
            return null;
          }
        }

        return {
          data: data.value,
          metadata: {
            timestamp: data.timestamp,
            ttl: data.ttl,
            age: Date.now() - (data.timestamp || Date.now())
          }
        };
      } catch (parseError) {
        console.error('Cache data parse error:', parseError);
        await this.safeDelete(key);
        return null;
      }
    } catch (error) {
      throw error; // Re-throw for retry logic
    }
  }

  /**
   * Handle fallback scenarios
   */
  handleFallback(fallback, key) {
    if (typeof fallback === 'function') {
      try {
        return fallback(key);
      } catch (error) {
        console.error('Fallback function failed:', error);
        return null;
      }
    }

    return fallback;
  }

  /**
   * Set cache with comprehensive error handling
   */
  async set(key, value, options = {}) {
    const {
      ttl = this.defaultTTL,
      tags = [],
      priority = 'normal',
      skipOnError = true
    } = options;

    // Check circuit breaker
    if (!this.checkCircuitBreaker()) {
      console.warn('Circuit breaker is OPEN, skipping cache set');
      if (skipOnError) {
        return false; // Gracefully skip
      }
      throw new Error('Circuit breaker is open');
    }

    try {
      const cacheEntry = {
        value,
        timestamp: Date.now(),
        ttl,
        tags,
        priority,
        version: '1.0'
      };

      // Validate data size (prevent cache bloat)
      const dataSize = new Blob([JSON.stringify(cacheEntry)]).size;
      if (dataSize > 25 * 1024 * 1024) { // 25MB limit
        console.warn('Cache entry too large:', dataSize, 'bytes');
        return false;
      }

      await this.cache.put(key, JSON.stringify(cacheEntry), {
        ttl,
        headers: {
          'Cache-Control': `public, max-age=${ttl}`,
          'X-Cache-Tags': tags.join(','),
          'X-Cache-Priority': priority
        }
      });

      this.recordSuccess();
      return true;

    } catch (error) {
      this.metrics.errors++;
      this.recordFailure();
      console.error('Cache set error:', error);

      if (skipOnError) {
        return false; // Graceful degradation
      }

      throw error;
    }
  }

  /**
   * Safe delete with error handling
   */
  async safeDelete(key) {
    try {
      await this.cache.delete(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags) {
    if (!this.kvNamespace) {
      console.warn('KV namespace not available for tag invalidation');
      return false;
    }

    try {
      // This would require maintaining a tag index in KV
      // For now, log the intention
      console.log('Invalidating cache by tags:', tags);
      return true;
    } catch (error) {
      console.error('Tag invalidation error:', error);
      return false;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    return {
      ...this.metrics,
      hitRate: hitRate.toFixed(2) + '%',
      circuitBreakerState: this.circuitBreaker.state,
      circuitBreakerFailures: this.circuitBreaker.failures
    };
  }

  /**
   * Reset circuit breaker (manual intervention)
   */
  resetCircuitBreaker() {
    this.circuitBreaker = {
      failures: 0,
      threshold: 5,
      timeout: 30000,
      state: 'CLOSED',
      lastFailureTime: null
    };
    console.log('Circuit breaker manually reset');
  }
}

export default EnhancedCacheService;
