/**
 * AI-Enhanced Rate Limiting Middleware
 * Revolutionary rate limiting with intelligent behavior analysis and adaptive throttling
 */

import type { Context, Next } from 'hono';
import type { Env, User, ProductContext } from '../types';

export interface RateLimitOptions {
  // Basic rate limiting
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;

  // Advanced features
  enableAI?: boolean;
  adaptiveThrottling?: boolean;
  behaviorAnalysis?: boolean;
  customKeyGenerator?: (c: Context) => Promise<string>;

  // Response options
  includeHeaders?: boolean;
  customResponse?: (c: Context, info: RateLimitInfo) => Response | void;

  // Storage options
  storagePrefix?: string;
  customStorage?: {
    get: (key: string) => Promise<RateLimitData | null>;
    set: (key: string, data: RateLimitData, ttl: number) => Promise<void>;
  };
}

export interface RateLimitData {
  count: number;
  resetTime: number;
  firstRequest: number;
  lastRequest: number;
  suspiciousActivity?: number;
  behaviorScore?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  isExceeded: boolean;
  behaviorScore?: number;
  adaptiveLimit?: number;
}

export interface BehaviorPattern {
  requestFrequency: number;
  timeVariance: number;
  endpointDiversity: number;
  payloadConsistency: number;
  geographicStability: number;
  userAgentConsistency: number;
}

export function RateLimitMiddleware(options: RateLimitOptions = {}) {
  const {
    requestsPerMinute = 60,
    requestsPerHour = 1000,
    requestsPerDay = 10000,
    enableAI = true,
    adaptiveThrottling = true,
    behaviorAnalysis = true,
    customKeyGenerator,
    includeHeaders = true,
    customResponse,
    storagePrefix = 'rate_limit',
    customStorage
  } = options;

  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const productContext = c.get('productContext') as ProductContext;
    const user = c.get('user') as User | undefined;

    // Generate rate limit key
    const key = await generateRateLimitKey(c, customKeyGenerator, storagePrefix);

    // Get current rate limit data
    const rateLimitData = await getRateLimitData(c, key, customStorage);
    const now = Date.now();

    // Analyze behavior if enabled
    let behaviorScore = 0;
    let behaviorPattern: BehaviorPattern | undefined;

    if (behaviorAnalysis && enableAI) {
      behaviorPattern = await analyzeRequestBehavior(c, rateLimitData, user);
      behaviorScore = calculateBehaviorScore(behaviorPattern);
    }

    // Calculate adaptive limits
    const adaptiveLimits = adaptiveThrottling
      ? await calculateAdaptiveLimits(c, user, behaviorScore, productContext)
      : {
          perMinute: requestsPerMinute,
          perHour: requestsPerHour,
          perDay: requestsPerDay
        };

    // Check rate limits
    const limits = [
      { window: 60 * 1000, limit: adaptiveLimits.perMinute, data: rateLimitData.minute },
      { window: 60 * 60 * 1000, limit: adaptiveLimits.perHour, data: rateLimitData.hour },
      { window: 24 * 60 * 60 * 1000, limit: adaptiveLimits.perDay, data: rateLimitData.day }
    ];

    let isExceeded = false;
    let limitInfo: RateLimitInfo | undefined;

    for (const limit of limits) {
      const windowStart = now - limit.window;

      // Clean old requests
      if (limit.data.firstRequest < windowStart) {
        limit.data.count = 1;
        limit.data.firstRequest = now;
        limit.data.resetTime = now + limit.window;
      } else {
        limit.data.count++;
      }

      limit.data.lastRequest = now;
      limit.data.behaviorScore = behaviorScore;

      if (limit.data.count > limit.limit) {
        isExceeded = true;
        limitInfo = {
          limit: limit.limit,
          remaining: Math.max(0, limit.limit - limit.data.count),
          resetTime: limit.data.resetTime,
          retryAfter: Math.ceil((limit.data.resetTime - now) / 1000),
          isExceeded: true,
          behaviorScore,
          adaptiveLimit: limit.limit
        };
        break;
      } else if (!limitInfo) {
        limitInfo = {
          limit: limit.limit,
          remaining: limit.limit - limit.data.count,
          resetTime: limit.data.resetTime,
          isExceeded: false,
          behaviorScore,
          adaptiveLimit: limit.limit
        };
      }
    }

    // Store updated rate limit data
    await setRateLimitData(c, key, rateLimitData, customStorage);

    // Log rate limit event for AI learning
    if (enableAI) {
      await logRateLimitEvent(c, {
        key,
        limitInfo,
        behaviorPattern,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }

    // Set response headers
    if (includeHeaders && limitInfo) {
      c.header('X-RateLimit-Limit', limitInfo.limit.toString());
      c.header('X-RateLimit-Remaining', limitInfo.remaining.toString());
      c.header('X-RateLimit-Reset', limitInfo.resetTime.toString());

      if (limitInfo.behaviorScore !== undefined) {
        c.header('X-RateLimit-Behavior-Score', limitInfo.behaviorScore.toString());
      }

      if (limitInfo.adaptiveLimit && limitInfo.adaptiveLimit !== limitInfo.limit) {
        c.header('X-RateLimit-Adaptive-Limit', limitInfo.adaptiveLimit.toString());
      }
    }

    // Handle exceeded limits
    if (isExceeded && limitInfo) {
      // AI-powered response if enabled
      if (enableAI && customResponse) {
        const customResp = customResponse(c, limitInfo);
        if (customResp) return customResp;
      }

      return c.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: enableAI ? {
            limit: limitInfo.limit,
            resetTime: new Date(limitInfo.resetTime).toISOString(),
            behaviorScore: limitInfo.behaviorScore,
            adaptiveLimit: limitInfo.adaptiveLimit,
            recommendations: await generateRateLimitRecommendations(behaviorPattern, user)
          } : undefined
        },
        meta: {
          rate_limit: {
            limit: limitInfo.limit,
            remaining: limitInfo.remaining,
            resetTime: limitInfo.resetTime,
            retryAfter: limitInfo.retryAfter
          }
        }
      }, 429);
    }

    // Store rate limit info for downstream middleware
    c.set('rateLimitInfo', limitInfo);

    await next();
  };
}

async function generateRateLimitKey(
  c: Context,
  customKeyGenerator?: (c: Context) => Promise<string>,
  prefix: string = 'rate_limit'
): Promise<string> {
  if (customKeyGenerator) {
    return await customKeyGenerator(c);
  }

  const user = c.get('user') as User | undefined;
  const organization = c.get('organization');
  const productContext = c.get('productContext') as ProductContext;

  // Priority: User ID > IP + User Agent > Organization + Product
  if (user) {
    return `${prefix}:user:${user.id}`;
  }

  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const userAgent = c.req.header('User-Agent') || 'unknown';
  const userAgentHash = await hashString(userAgent);

  if (organization) {
    return `${prefix}:org:${organization.id}:${productContext.product}:${clientIP}:${userAgentHash}`;
  }

  return `${prefix}:ip:${clientIP}:${productContext.product}:${userAgentHash}`;
}

async function getRateLimitData(
  c: Context,
  key: string,
  customStorage?: RateLimitOptions['customStorage']
): Promise<{
  minute: RateLimitData;
  hour: RateLimitData;
  day: RateLimitData;
}> {
  const now = Date.now();
  const env = c.env as any;

  const getStorageData = async (suffix: string): Promise<RateLimitData> => {
    const storageKey = `${key}:${suffix}`;

    if (customStorage) {
      const data = await customStorage.get(storageKey);
      if (data) return data;
    } else {
      try {
        const data = await env.RATE_LIMITS.get(storageKey);
        if (data) return JSON.parse(data);
      } catch (error) {
        console.error('Failed to get rate limit data:', error);
      }
    }

    // Default data
    return {
      count: 0,
      resetTime: now + getSuffixDuration(suffix),
      firstRequest: now,
      lastRequest: now,
      suspiciousActivity: 0,
      behaviorScore: 0
    };
  };

  return {
    minute: await getStorageData('1m'),
    hour: await getStorageData('1h'),
    day: await getStorageData('1d')
  };
}

async function setRateLimitData(
  c: Context,
  key: string,
  data: any,
  customStorage?: RateLimitOptions['customStorage']
): Promise<void> {
  const env = c.env as any;

  const setStorageData = async (suffix: string, rateData: RateLimitData, ttl: number) => {
    const storageKey = `${key}:${suffix}`;

    if (customStorage) {
      await customStorage.set(storageKey, rateData, ttl);
    } else {
      try {
        await env.RATE_LIMITS.put(storageKey, JSON.stringify(rateData), { expirationTtl: ttl });
      } catch (error) {
        console.error('Failed to set rate limit data:', error);
      }
    }
  };

  await Promise.all([
    setStorageData('1m', data.minute, 60),
    setStorageData('1h', data.hour, 60 * 60),
    setStorageData('1d', data.day, 24 * 60 * 60)
  ]);
}

async function analyzeRequestBehavior(
  c: Context,
  rateLimitData: any,
  user?: User
): Promise<BehaviorPattern> {
  try {
    const env = c.env as any;
    const url = new URL(c.req.url);
    const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
    const userAgent = c.req.header('User-Agent') || 'unknown';

    // Get historical behavior data
    const behaviorKey = `behavior:${user?.id || clientIP}`;
    const historicalData = await env.AGENT_MEMORY.get(behaviorKey);
    const history = historicalData ? JSON.parse(historicalData) : {
      requests: [],
      endpoints: new Set(),
      userAgents: new Set(),
      timeVariance: [],
      geographicData: []
    };

    // Analyze current request
    const now = Date.now();
    const currentRequest = {
      timestamp: now,
      endpoint: url.pathname,
      method: c.req.method,
      userAgent,
      ip: clientIP
    };

    // Update history
    history.requests.push(currentRequest);
    history.endpoints.add(url.pathname);
    history.userAgents.add(userAgent);

    // Keep only last 100 requests
    if (history.requests.length > 100) {
      history.requests = history.requests.slice(-100);
    }

    // Calculate behavior metrics
    const pattern = calculateBehaviorPattern(history, currentRequest);

    // Store updated history
    await env.AGENT_MEMORY.put(behaviorKey, JSON.stringify(history), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days
    });

    return pattern;
  } catch (error) {
    console.error('Behavior analysis failed:', error);

    // Return neutral pattern
    return {
      requestFrequency: 0.5,
      timeVariance: 0.5,
      endpointDiversity: 0.5,
      payloadConsistency: 0.5,
      geographicStability: 0.5,
      userAgentConsistency: 0.5
    };
  }
}

function calculateBehaviorPattern(history: any, currentRequest: any): BehaviorPattern {
  const requests = history.requests;

  if (requests.length < 2) {
    return {
      requestFrequency: 0.5,
      timeVariance: 0.5,
      endpointDiversity: 0.5,
      payloadConsistency: 0.5,
      geographicStability: 0.5,
      userAgentConsistency: 0.5
    };
  }

  // Request frequency (requests per minute)
  const timeSpan = requests[requests.length - 1].timestamp - requests[0].timestamp;
  const requestFrequency = Math.min(1, (requests.length / timeSpan) * 60000 / 100); // Normalize to 0-1

  // Time variance (consistency of request timing)
  const intervals = [];
  for (let i = 1; i < requests.length; i++) {
    intervals.push(requests[i].timestamp - requests[i - 1].timestamp);
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
  const timeVariance = Math.min(1, variance / avgInterval);

  // Endpoint diversity (how many different endpoints)
  const endpointDiversity = Math.min(1, history.endpoints.size / 20);

  // Payload consistency (method consistency)
  const methods = requests.map(r => r.method);
  const methodConsistency = methods.filter(m => m === methods[0]).length / methods.length;
  const payloadConsistency = methodConsistency;

  // Geographic stability (IP consistency)
  const ips = requests.map(r => r.ip);
  const ipConsistency = ips.filter(ip => ip === ips[0]).length / ips.length;
  const geographicStability = ipConsistency;

  // User agent consistency
  const userAgents = Array.from(history.userAgents);
  const userAgentConsistency = userAgents.filter(ua => ua === userAgents[0]).length / userAgents.length;

  return {
    requestFrequency,
    timeVariance,
    endpointDiversity,
    payloadConsistency,
    geographicStability,
    userAgentConsistency
  };
}

function calculateBehaviorScore(pattern: BehaviorPattern): number {
  // Higher score = more suspicious
  let score = 0;

  // High request frequency is suspicious
  score += pattern.requestFrequency * 0.3;

  // Low time variance (very consistent timing) is suspicious
  score += (1 - pattern.timeVariance) * 0.2;

  // Low endpoint diversity (repeated requests to same endpoint) is suspicious
  score += (1 - pattern.endpointDiversity) * 0.2;

  // Low geographic stability (changing IPs) is suspicious
  score += (1 - pattern.geographicStability) * 0.2;

  // Low user agent consistency is suspicious
  score += (1 - pattern.userAgentConsistency) * 0.1;

  return Math.min(1, score);
}

async function calculateAdaptiveLimits(
  c: Context,
  user?: User,
  behaviorScore: number = 0,
  productContext?: ProductContext
): Promise<{
  perMinute: number;
  perHour: number;
  perDay: number;
}> {
  const baseLimits = {
    perMinute: 60,
    perHour: 1000,
    perDay: 10000
  };

  // Adjust based on user role
  if (user) {
    const roleMultipliers = {
      admin: 2.0,
      finance: 1.5,
      compliance: 1.3,
      auditor: 1.2,
      viewer: 1.0
    };

    const multiplier = roleMultipliers[user.role] || 1.0;
    baseLimits.perMinute = Math.floor(baseLimits.perMinute * multiplier);
    baseLimits.perHour = Math.floor(baseLimits.perHour * multiplier);
    baseLimits.perDay = Math.floor(baseLimits.perDay * multiplier);
  }

  // Adjust based on behavior score
  const behaviorMultiplier = Math.max(0.1, 1 - behaviorScore);
  baseLimits.perMinute = Math.floor(baseLimits.perMinute * behaviorMultiplier);
  baseLimits.perHour = Math.floor(baseLimits.perHour * behaviorMultiplier);
  baseLimits.perDay = Math.floor(baseLimits.perDay * behaviorMultiplier);

  // Adjust based on subscription tier
  if (productContext) {
    try {
      const env = c.env as any;
      const orgSettingsKey = `org_settings:${productContext.organization_id}`;
      const orgSettings = await env.CACHE.get(orgSettingsKey);

      if (orgSettings) {
        const settings = JSON.parse(orgSettings);
        const tierMultipliers = {
          free: 0.5,
          starter: 1.0,
          professional: 2.0,
          enterprise: 5.0
        };

        const tierMultiplier = tierMultipliers[settings.subscription_tier] || 1.0;
        baseLimits.perMinute = Math.floor(baseLimits.perMinute * tierMultiplier);
        baseLimits.perHour = Math.floor(baseLimits.perHour * tierMultiplier);
        baseLimits.perDay = Math.floor(baseLimits.perDay * tierMultiplier);
      }
    } catch (error) {
      console.error('Failed to get organization settings:', error);
    }
  }

  return baseLimits;
}

async function generateRateLimitRecommendations(
  behaviorPattern?: BehaviorPattern,
  user?: User
): Promise<string[]> {
  const recommendations: string[] = [];

  if (!behaviorPattern) {
    return ['Please wait before making more requests'];
  }

  if (behaviorPattern.requestFrequency > 0.8) {
    recommendations.push('Consider reducing request frequency');
  }

  if (behaviorPattern.endpointDiversity < 0.3) {
    recommendations.push('Try using different endpoints or caching responses');
  }

  if (behaviorPattern.geographicStability < 0.5) {
    recommendations.push('Consistent geographic location is recommended');
  }

  if (user && user.role === 'viewer') {
    recommendations.push('Consider upgrading your plan for higher rate limits');
  }

  if (recommendations.length === 0) {
    recommendations.push('Wait a moment before making more requests');
  }

  return recommendations;
}

async function logRateLimitEvent(c: Context, event: any): Promise<void> {
  try {
    const env = c.env as any;
    const productContext = c.get('productContext') as ProductContext;
    const user = c.get('user') as User | undefined;

    const logEntry = {
      timestamp: event.timestamp,
      key: event.key,
      limitInfo: event.limitInfo,
      behaviorPattern: event.behaviorPattern,
      processingTime: event.processingTime,
      userId: user?.id,
      organizationId: user?.organization_id,
      product: productContext.product,
      region: productContext.region,
      ipAddress: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
      endpoint: new URL(c.req.url).pathname,
      method: c.req.method
    };

    // Store for AI learning and analytics
    const logKey = `rate_limit_log:${Date.now()}:${crypto.randomUUID()}`;
    await env.AGENT_MEMORY.put(logKey, JSON.stringify(logEntry), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });

    // Update real-time metrics
    const metricsKey = `rate_limit_metrics:${new Date().toISOString().split('T')[0]}`;
    const currentMetrics = await env.AGENT_MEMORY.get(metricsKey);

    let metrics = currentMetrics ? JSON.parse(currentMetrics) : {
      total_requests: 0,
      blocked_requests: 0,
      behavior_scores: [],
      adaptive_adjustments: 0
    };

    metrics.total_requests++;
    if (event.limitInfo.isExceeded) {
      metrics.blocked_requests++;
    }

    if (event.behaviorPattern) {
      metrics.behavior_scores.push(calculateBehaviorScore(event.behaviorPattern));
    }

    if (event.limitInfo.adaptiveLimit && event.limitInfo.adaptiveLimit !== event.limitInfo.limit) {
      metrics.adaptive_adjustments++;
    }

    await env.AGENT_MEMORY.put(metricsKey, JSON.stringify(metrics), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days
    });
  } catch (error) {
    console.error('Failed to log rate limit event:', error);
  }
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

function getSuffixDuration(suffix: string): number {
  const durations = {
    '1m': 60,
    '1h': 60 * 60,
    '1d': 24 * 60 * 60
  };
  return durations[suffix] || 60;
}

// Predefined rate limit configurations
export const createStrictRateLimit = () => RateLimitMiddleware({
  requestsPerMinute: 30,
  requestsPerHour: 500,
  requestsPerDay: 5000,
  enableAI: true,
  adaptiveThrottling: true,
  behaviorAnalysis: true
});

export const createModerateRateLimit = () => RateLimitMiddleware({
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  requestsPerDay: 10000,
  enableAI: true,
  adaptiveThrottling: true,
  behaviorAnalysis: true
});

export const createLenientRateLimit = () => RateLimitMiddleware({
  requestsPerMinute: 120,
  requestsPerHour: 2000,
  requestsPerDay: 20000,
  enableAI: false,
  adaptiveThrottling: false,
  behaviorAnalysis: false
});

export const createAPIRateLimit = () => RateLimitMiddleware({
  requestsPerMinute: 100,
  requestsPerHour: 5000,
  requestsPerDay: 50000,
  enableAI: true,
  adaptiveThrottling: true,
  behaviorAnalysis: true,
  customKeyGenerator: async (c) => {
    const user = c.get('user');
    const apiKey = c.req.header('X-API-Key');
    if (user) return `api:user:${user.id}`;
    if (apiKey) return `api:key:${await hashString(apiKey)}`;
    return `api:ip:${c.req.header('CF-Connecting-IP')}`;
  }
});