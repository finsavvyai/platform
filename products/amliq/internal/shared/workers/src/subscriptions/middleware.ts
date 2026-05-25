/**
 * Subscription Middleware
 *
 * Middleware for checking subscription limits, tracking usage,
 * and enforcing rate limits based on subscription tiers.
 */

import { Context, Next } from 'hono';
import { SubscriptionService } from './subscription-service';

export interface SubscriptionLimits {
  api_requests_per_month: number;
  ai_requests_per_month: number;
  api_calls_per_minute: number;
  concurrent_sessions: number;
  ai_features: {
    fraud_detection: boolean;
    document_verification: boolean;
    transaction_categorization: boolean;
    cash_flow_forecasting: boolean;
    risk_assessment: boolean;
    anomaly_detection: boolean;
    natural_language_processing: boolean;
    multimodal_processing: boolean;
  };
}

export interface SubscriptionContext {
  subscription_id: string;
  tier_id: string;
  status: string;
  limits: SubscriptionLimits;
  usage: {
    api_requests: { current: number; limit: number; };
    ai_requests: { current: number; limit: number; };
  };
  ai_features: SubscriptionLimits['ai_features'];
}

/**
 * Middleware to check subscription and enforce limits
 */
export function subscriptionMiddleware(options: {
  checkUsage?: boolean;
  trackUsage?: boolean;
  allowOverage?: boolean;
} = {}) {
  const {
    checkUsage = true,
    trackUsage = true,
    allowOverage = false
  } = options;

  return async (c: Context, next: Next) => {
    const organizationId = c.get('organization_id');
    if (!organizationId) {
      return c.json({
        success: false,
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: 'Organization ID is required'
        }
      }, 401);
    }

    try {
      // Get subscription for organization
      const subscriptionService = new SubscriptionService(c.env);
      const subscription = await subscriptionService.getOrganizationSubscription(organizationId);

      if (!subscription) {
        return c.json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_REQUIRED',
            message: 'Active subscription is required to access this feature',
            upgrade_url: 'https://finsavvyai.com/pricing'
          }
        }, 402);
      }

      // Check subscription status
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return c.json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_INACTIVE',
            message: `Subscription is ${subscription.status}. Please update your payment method.`,
            status: subscription.status,
            billing_url: 'https://dashboard.finsavvyai.com/billing'
          }
        }, 402);
      }

      // Create subscription context
      const subscriptionContext: SubscriptionContext = {
        subscription_id: subscription.id,
        tier_id: subscription.tier_id,
        status: subscription.status,
        limits: subscription.tier.limits,
        usage: {
          api_requests: subscription.usage.api_requests,
          ai_requests: subscription.usage.ai_requests
        },
        ai_features: subscription.tier.ai_features
      };

      // Set subscription context
      c.set('subscription', subscriptionContext);

      // Check rate limits
      if (checkUsage) {
        const rateLimitResult = await checkRateLimits(c, subscriptionContext);
        if (!rateLimitResult.allowed) {
          return c.json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: rateLimitResult.message,
              reset_date: rateLimitResult.reset_date,
              upgrade_required: rateLimitResult.upgrade_required,
              suggested_tier: rateLimitResult.suggested_tier
            },
            headers: {
              'X-RateLimit-Limit': rateLimitResult.limit.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.reset_date?.toString() || '',
              'X-RateLimit-Retry-After': rateLimitResult.retry_after?.toString() || ''
            }
          }, 429);
        }
      }

      // Check AI feature access
      const path = c.req.path;
      if (path.includes('/ai/') || path.includes('/intelligence/') || path.includes('/risk/')) {
        const aiFeatureCheck = checkAIFeatureAccess(path, subscriptionContext.ai_features);
        if (!aiFeatureCheck.allowed) {
          return c.json({
            success: false,
            error: {
              code: 'AI_FEATURE_NOT_AVAILABLE',
              message: `AI feature '${aiFeatureCheck.feature}' is not available in your current subscription tier`,
              upgrade_required: true,
              feature: aiFeatureCheck.feature
            }
          }, 403);
        }
      }

      // Process request
      await next();

      // Track usage after successful request
      if (trackUsage && c.res.status < 400) {
        await trackRequestUsage(c, subscriptionContext);
      }

    } catch (error) {
      console.error('Subscription middleware error:', error);

      // Continue with request if subscription check fails
      // This prevents service disruption during subscription service issues
      await next();
    }
  };
}

/**
 * Check rate limits for API requests
 */
async function checkRateLimits(c: Context, subscription: SubscriptionContext): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_date?: number;
  retry_after?: number;
  message: string;
  upgrade_required?: boolean;
  suggested_tier?: string;
}> {
  const now = Date.now();
  const subscriptionService = new SubscriptionService(c.env);

  // Check monthly API request limit
  const monthlyResult = await subscriptionService.checkSubscriptionLimits(
    subscription.subscription_id,
    'api_request',
    1
  );

  if (!monthlyResult.allowed) {
    return {
      allowed: false,
      limit: subscription.usage.api_requests.limit,
      remaining: 0,
      reset_date: subscription.usage.api_requests.reset_date,
      retry_after: Math.ceil((subscription.usage.api_requests.reset_date - now) / 1000),
      message: 'Monthly API request limit exceeded',
      upgrade_required: monthlyResult.upgrade_required,
      suggested_tier: monthlyResult.suggested_tier
    };
  }

  // Check per-minute rate limit
  const minuteKey = `rate_limit:${subscription.subscription_id}:${Math.floor(now / 60000)}`;
  const currentMinuteRequests = await getCurrentMinuteRequests(c, minuteKey);

  if (currentMinuteRequests >= subscription.limits.api_calls_per_minute) {
    const nextMinute = Math.ceil(now / 60000) * 60000 + 60000;
    return {
      allowed: false,
      limit: subscription.limits.api_calls_per_minute,
      remaining: 0,
      reset_date: nextMinute,
      retry_after: Math.ceil((nextMinute - now) / 1000),
      message: 'Per-minute rate limit exceeded. Please wait before making more requests.'
    };
  }

  return {
    allowed: true,
    limit: subscription.limits.api_calls_per_minute,
    remaining: Math.max(0, subscription.limits.api_calls_per_minute - currentMinuteRequests - 1),
    message: 'Rate limit check passed'
  };
}

/**
 * Check if AI feature is available in current subscription
 */
function checkAIFeatureAccess(path: string, aiFeatures: SubscriptionLimits['ai_features']): {
  allowed: boolean;
  feature: string;
} {
  // Map URL patterns to AI features
  const featureMap = {
    '/billing/fraud': 'fraud_detection',
    '/compliance/verify': 'document_verification',
    '/intelligence/categorize': 'transaction_categorization',
    '/intelligence/forecast': 'cash_flow_forecasting',
    '/risk/assess': 'risk_assessment',
    '/intelligence/anomalies': 'anomaly_detection',
    '/ai/nlp': 'natural_language_processing',
    '/ai/multimodal': 'multimodal_processing'
  };

  for (const [pattern, feature] of Object.entries(featureMap)) {
    if (path.includes(pattern)) {
      return {
        allowed: aiFeatures[feature] || false,
        feature
      };
    }
  }

  return {
    allowed: true,
    feature: 'general'
  };
}

/**
 * Track usage for successful requests
 */
async function trackRequestUsage(c: Context, subscription: SubscriptionContext): Promise<void> {
  try {
    const subscriptionService = new SubscriptionService(c.env);
    const path = c.req.path;
    const method = c.req.method;

    // Determine usage type based on request
    let usageType = 'api_request';
    let quantity = 1;

    if (path.includes('/ai/') || path.includes('/intelligence/ai') || path.includes('/risk/ai')) {
      usageType = 'ai_request';
    } else if (path.includes('/transactions') && method === 'POST') {
      usageType = 'transaction';
    } else if (path.includes('/kyc') && method === 'POST') {
      usageType = 'kyc_verification';
    } else if (path.includes('/risk/events') && method === 'POST') {
      usageType = 'risk_assessment';
    }

    // Record usage event
    await subscriptionService.recordUsage({
      subscription_id: subscription.subscription_id,
      organization_id: c.get('organization_id'),
      event_type: usageType,
      quantity,
      unit: 'request',
      metadata: {
        path,
        method,
        user_agent: c.req.header('user-agent'),
        ip_address: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')
      }
    });

    // Update rate limiting cache
    const now = Date.now();
    const minuteKey = `rate_limit:${subscription.subscription_id}:${Math.floor(now / 60000)}`;
    await incrementMinuteRequests(c, minuteKey);

  } catch (error) {
    console.error('Usage tracking error:', error);
    // Don't fail the request if usage tracking fails
  }
}

/**
 * Get current minute request count from cache
 */
async function getCurrentMinuteRequests(c: Context, key: string): Promise<number> {
  try {
    // Use KV store for rate limiting
    const result = await c.env.KV.get(key);
    return result ? parseInt(result, 10) : 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Increment current minute request count
 */
async function incrementMinuteRequests(c: Context, key: string): Promise<void> {
  try {
    const current = await getCurrentMinuteRequests(c, key);
    await c.env.KV.put(key, (current + 1).toString(), {
      expirationTtl: 120 // Expire after 2 minutes
    });
  } catch (error) {
    console.error('Rate limit increment error:', error);
  }
}

/**
 * Middleware to require specific AI features
 */
export function requireAIFeature(feature: keyof SubscriptionLimits['ai_features']) {
  return async (c: Context, next: Next) => {
    const subscription = c.get('subscription') as SubscriptionContext;

    if (!subscription || !subscription.ai_features[feature]) {
      return c.json({
        success: false,
        error: {
          code: 'AI_FEATURE_REQUIRED',
          message: `This feature requires '${feature}' which is not available in your current subscription tier`,
          feature,
          upgrade_required: true,
          upgrade_url: 'https://finsavvyai.com/pricing'
        }
      }, 403);
    }

    await next();
  };
}

/**
 * Middleware to check AI request limits
 */
export function checkAIRequestLimits(quantity: number = 1) {
  return async (c: Context, next: Next) => {
    const subscription = c.get('subscription') as SubscriptionContext;

    if (!subscription) {
      return c.json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Subscription is required for AI features'
        }
      }, 402);
    }

    try {
      const subscriptionService = new SubscriptionService(c.env);
      const limitCheck = await subscriptionService.checkSubscriptionLimits(
        subscription.subscription_id,
        'ai_request',
        quantity
      );

      if (!limitCheck.allowed) {
        return c.json({
          success: false,
          error: {
            code: 'AI_REQUEST_LIMIT_EXCEEDED',
            message: 'AI request limit exceeded for this billing period',
            remaining: limitCheck.remaining,
            reset_date: limitCheck.reset_date,
            upgrade_required: limitCheck.upgrade_required,
            suggested_tier: limitCheck.suggested_tier
          }
        }, 429);
      }

      await next();

    } catch (error) {
      console.error('AI limit check error:', error);
      await next();
    }
  };
}

/**
 * Middleware to add subscription headers to responses
 */
export function subscriptionHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    const subscription = c.get('subscription') as SubscriptionContext;
    if (subscription) {
      // Add subscription information to response headers
      c.res.headers.set('X-Subscription-Tier', subscription.tier_id);
      c.res.headers.set('X-Subscription-Status', subscription.status);
      c.res.headers.set('X-API-Requests-Remaining', subscription.usage.api_requests.remaining.toString());
      c.res.headers.set('X-AI-Requests-Remaining', subscription.usage.ai_requests.remaining.toString());
    }
  };
}

/**
 * Get subscription usage summary
 */
export async function getUsageSummary(c: Context): Promise<any> {
  const subscription = c.get('subscription') as SubscriptionContext;

  if (!subscription) {
    return null;
  }

  try {
    const subscriptionService = new SubscriptionService(c.env);
    const analytics = await subscriptionService.generateSubscriptionAnalytics(
      subscription.subscription_id,
      subscription.usage.api_requests.reset_date - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      subscription.usage.api_requests.reset_date
    );

    return analytics;

  } catch (error) {
    console.error('Get usage summary error:', error);
    return null;
  }
}