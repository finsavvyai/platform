/**
 * Rate Limiter - DDoS protection and API rate limiting
 * Prevents abuse and controls resource usage
 */

export class RateLimiter {
  constructor(env) {
    this.cache = env.CACHE;
  }

  /**
   * Check if request is within rate limit
   * @param {string} identifier - Unique identifier (IP, user ID, API key)
   * @param {Object} options - Rate limit options
   * @returns {Promise<Object>} Rate limit status
   */
  async checkRateLimit(identifier, options = {}) {
    const {
      limit = 100,          // Max requests
      window = 60,          // Time window in seconds
      namespace = 'global'  // Namespace for different rate limit types
    } = options;

    const key = `ratelimit:${namespace}:${identifier}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - window;

    try {
      // Get current request log
      const data = await this.cache.get(key);
      let requests = data ? JSON.parse(data) : [];

      // Filter out requests outside the time window
      requests = requests.filter(timestamp => timestamp > windowStart);

      // Check if limit exceeded
      if (requests.length >= limit) {
        const oldestRequest = Math.min(...requests);
        const retryAfter = oldestRequest + window - now;

        return {
          allowed: false,
          limit,
          remaining: 0,
          retryAfter: Math.max(1, retryAfter),
          resetAt: oldestRequest + window
        };
      }

      // Add current request
      requests.push(now);

      // Store updated request log
      await this.cache.put(key, JSON.stringify(requests), {
        expirationTtl: window * 2 // Keep data for 2x the window for safety
      });

      return {
        allowed: true,
        limit,
        remaining: limit - requests.length,
        retryAfter: null,
        resetAt: now + window
      };

    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow the request but log it
      return {
        allowed: true,
        limit,
        remaining: limit,
        retryAfter: null,
        resetAt: now + window,
        error: true
      };
    }
  }

  /**
   * IP-based rate limiting (prevents DDoS)
   * @param {Request} request - Incoming request
   * @returns {Promise<Object>} Rate limit status
   */
  async checkIpRateLimit(request) {
    const ip = request.headers.get('CF-Connecting-IP') ||
               request.headers.get('X-Forwarded-For') ||
               'unknown';

    return await this.checkRateLimit(ip, {
      limit: 60,      // 60 requests
      window: 60,     // per minute
      namespace: 'ip'
    });
  }

  /**
   * User-based rate limiting (authenticated users)
   * @param {string} userId - User ID
   * @param {string} tier - User tier (free, pro, enterprise)
   * @returns {Promise<Object>} Rate limit status
   */
  async checkUserRateLimit(userId, tier = 'free') {
    const limits = {
      free: { limit: 100, window: 3600 },      // 100 per hour
      pro: { limit: 1000, window: 3600 },      // 1000 per hour
      enterprise: { limit: 10000, window: 3600 } // 10000 per hour
    };

    const config = limits[tier] || limits.free;

    return await this.checkRateLimit(userId, {
      ...config,
      namespace: 'user'
    });
  }

  /**
   * API key-based rate limiting
   * @param {string} apiKey - API key
   * @param {string} tier - Subscription tier
   * @returns {Promise<Object>} Rate limit status
   */
  async checkApiKeyRateLimit(apiKey, tier = 'free') {
    const limits = {
      free: { limit: 100, window: 86400 },      // 100 per day
      pro: { limit: 10000, window: 86400 },     // 10K per day
      enterprise: { limit: 100000, window: 86400 } // 100K per day
    };

    const config = limits[tier] || limits.free;

    return await this.checkRateLimit(apiKey, {
      ...config,
      namespace: 'apikey'
    });
  }

  /**
   * Endpoint-specific rate limiting
   * @param {string} identifier - User/IP identifier
   * @param {string} endpoint - Endpoint path
   * @param {Object} customLimits - Custom limit configuration
   * @returns {Promise<Object>} Rate limit status
   */
  async checkEndpointRateLimit(identifier, endpoint, customLimits = {}) {
    const defaultLimits = {
      '/api/search': { limit: 20, window: 60 },          // 20 searches per minute
      '/api/index': { limit: 10, window: 3600 },         // 10 index operations per hour
      '/api/vision': { limit: 5, window: 60 },           // 5 vision analyses per minute
      '/api/webhooks': { limit: 100, window: 60 }        // 100 webhooks per minute
    };

    const config = customLimits[endpoint] || defaultLimits[endpoint] || { limit: 60, window: 60 };

    return await this.checkRateLimit(`${identifier}:${endpoint}`, {
      ...config,
      namespace: 'endpoint'
    });
  }

  /**
   * Create rate limit response headers
   * @param {Object} rateLimit - Rate limit result
   * @returns {Object} Headers object
   */
  getRateLimitHeaders(rateLimit) {
    return {
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(rateLimit.resetAt),
      ...(rateLimit.retryAfter && {
        'Retry-After': String(rateLimit.retryAfter)
      })
    };
  }

  /**
   * Create rate limit exceeded response
   * @param {Object} rateLimit - Rate limit result
   * @returns {Response} Rate limit error response
   */
  createRateLimitResponse(rateLimit) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Rate limit exceeded',
      error_code: 'rate_limit_exceeded',
      limit: rateLimit.limit,
      retryAfter: rateLimit.retryAfter,
      resetAt: new Date(rateLimit.resetAt * 1000).toISOString()
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...this.getRateLimitHeaders(rateLimit)
      }
    });
  }

  /**
   * Reset rate limit for identifier (admin function)
   * @param {string} identifier - Identifier to reset
   * @param {string} namespace - Namespace
   */
  async resetRateLimit(identifier, namespace = 'global') {
    const key = `ratelimit:${namespace}:${identifier}`;
    await this.cache.delete(key);
  }

  /**
   * Get current rate limit status without incrementing
   * @param {string} identifier - Identifier to check
   * @param {string} namespace - Namespace
   * @returns {Promise<Object>} Current status
   */
  async getRateLimitStatus(identifier, namespace = 'global') {
    const key = `ratelimit:${namespace}:${identifier}`;
    const data = await this.cache.get(key);

    if (!data) {
      return {
        requests: 0,
        limit: null,
        resetAt: null
      };
    }

    const requests = JSON.parse(data);
    return {
      requests: requests.length,
      oldestRequest: Math.min(...requests),
      newestRequest: Math.max(...requests)
    };
  }

  /**
   * Burst protection - allows temporary spikes but prevents sustained high load
   * @param {string} identifier - Identifier
   * @param {Object} options - Burst options
   * @returns {Promise<Object>} Rate limit status
   */
  async checkBurstRateLimit(identifier, options = {}) {
    const {
      burstLimit = 20,      // Allow burst of 20 requests
      burstWindow = 10,     // Over 10 seconds
      sustainedLimit = 100, // But only 100
      sustainedWindow = 60  // per minute sustained
    } = options;

    // Check burst limit
    const burstResult = await this.checkRateLimit(identifier, {
      limit: burstLimit,
      window: burstWindow,
      namespace: 'burst'
    });

    if (!burstResult.allowed) {
      return burstResult;
    }

    // Check sustained limit
    const sustainedResult = await this.checkRateLimit(identifier, {
      limit: sustainedLimit,
      window: sustainedWindow,
      namespace: 'sustained'
    });

    return sustainedResult;
  }
}

export default RateLimiter;
