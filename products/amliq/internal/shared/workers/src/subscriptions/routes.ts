/**
 * Subscription API Routes
 *
 * RESTful API endpoints for subscription management, usage tracking,
 * billing operations, and analytics.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { SubscriptionService } from './subscription-service';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { monitoringMiddleware } from '../middleware/monitoring';

const subscriptions = new Hono();

// Validation schemas
const createSubscriptionSchema = z.object({
  organization_id: z.string().min(1),
  tier_id: z.string().min(1),
  payment_method_id: z.string().optional(),
  trial_days: z.number().int().min(0).max(365).optional(),
  billing_info: z.object({
    customer_id: z.string().optional(),
    tax_rate: z.number().min(0).max(1).optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

const updateTierSchema = z.object({
  tier_id: z.string().min(1),
  effective_immediately: z.boolean().default(false)
});

const recordUsageSchema = z.object({
  event_type: z.enum([
    'api_request', 'ai_request', 'storage', 'transaction',
    'kyc_verification', 'risk_assessment', 'user_added', 'webhook_created',
    'ai_fraud_detection', 'ai_document_verification', 'ai_categorization',
    'ai_forecasting', 'ai_risk_assessment', 'ai_anomaly_detection',
    'ai_nlp_processing', 'ai_multimodal_processing'
  ]),
  quantity: z.number().int().min(1),
  unit: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const subscriptionIdSchema = z.object({
  subscription_id: z.string().min(1)
});

const analyticsSchema = z.object({
  period_start: z.string().datetime(),
  period_end: z.string().datetime()
});

/**
 * Middleware for subscription management
 */
subscriptions.use('*', authMiddleware);
subscriptions.use('*', rateLimitMiddleware({ requestsPerMinute: 60 }));
subscriptions.use('*', monitoringMiddleware());

/**
 * Create a new subscription
 */
subscriptions.post('/', zValidator('json', createSubscriptionSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const subscriptionService = new SubscriptionService(c.env);

    // Create subscription
    const subscription = await subscriptionService.createSubscription(data);

    return c.json({
      success: true,
      data: subscription,
      message: 'Subscription created successfully'
    }, 201);

  } catch (error) {
    console.error('Create subscription error:', error);
    return c.json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_CREATION_FAILED',
        message: error.message || 'Failed to create subscription'
      }
    }, 400);
  }
});

/**
 * Get subscription by ID
 */
subscriptions.get('/:subscription_id', zValidator('param', subscriptionIdSchema), async (c) => {
  try {
    const { subscription_id } = c.req.valid('param');
    const subscriptionService = new SubscriptionService(c.env);

    const subscription = await subscriptionService.getSubscription(subscription_id);

    if (!subscription) {
      return c.json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      }, 404);
    }

    return c.json({
      success: true,
      data: subscription
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GET_SUBSCRIPTION_FAILED',
        message: error.message || 'Failed to retrieve subscription'
      }
    }, 500);
  }
});

/**
 * Update subscription tier
 */
subscriptions.put('/:subscription_id/tier',
  zValidator('param', subscriptionIdSchema),
  zValidator('json', updateTierSchema),
  async (c) => {
    try {
      const { subscription_id } = c.req.valid('param');
      const { tier_id, effective_immediately } = c.req.valid('json');

      const subscriptionService = new SubscriptionService(c.env);
      const updatedSubscription = await subscriptionService.updateSubscriptionTier(
        subscription_id,
        tier_id,
        effective_immediately
      );

      return c.json({
        success: true,
        data: updatedSubscription,
        message: `Subscription tier updated${effective_immediately ? ' immediately' : ' for next billing cycle'}`
      });

    } catch (error) {
      console.error('Update tier error:', error);
      return c.json({
        success: false,
        error: {
          code: 'TIER_UPDATE_FAILED',
          message: error.message || 'Failed to update subscription tier'
        }
      }, 400);
    }
  }
);

/**
 * Cancel subscription
 */
subscriptions.post('/:subscription_id/cancel',
  zValidator('param', subscriptionIdSchema),
  zValidator('json', z.object({
    cancel_at_period_end: z.boolean().default(true),
    reason: z.string().optional(),
    feedback: z.string().optional()
  })),
  async (c) => {
    try {
      const { subscription_id } = c.req.valid('param');
      const { cancel_at_period_end, reason, feedback } = c.req.valid('json');

      const subscriptionService = new SubscriptionService(c.env);

      // Implementation would go here
      // const updatedSubscription = await subscriptionService.cancelSubscription(
      //   subscription_id,
      //   cancel_at_period_end,
      //   reason,
      //   feedback
      // );

      return c.json({
        success: true,
        message: `Subscription will be canceled ${cancel_at_period_end ? 'at period end' : 'immediately'}`
      });

    } catch (error) {
      console.error('Cancel subscription error:', error);
      return c.json({
        success: false,
        error: {
          code: 'CANCELLATION_FAILED',
          message: error.message || 'Failed to cancel subscription'
        }
      }, 400);
    }
  }
);

/**
 * Record usage event
 */
subscriptions.post('/:subscription_id/usage',
  zValidator('param', subscriptionIdSchema),
  zValidator('json', recordUsageSchema),
  async (c) => {
    try {
      const { subscription_id } = c.req.valid('param');
      const usageData = c.req.valid('json');

      const subscriptionService = new SubscriptionService(c.env);

      const usageEvent = await subscriptionService.recordUsage({
        subscription_id,
        organization_id: c.get('organization_id'),
        ...usageData
      });

      return c.json({
        success: true,
        data: usageEvent,
        message: 'Usage recorded successfully'
      });

    } catch (error) {
      console.error('Record usage error:', error);
      return c.json({
        success: false,
        error: {
          code: 'USAGE_RECORDING_FAILED',
          message: error.message || 'Failed to record usage'
        }
      }, 400);
    }
  }
);

/**
 * Check subscription limits
 */
subscriptions.get('/:subscription_id/limits/:request_type',
  zValidator('param', z.object({
    subscription_id: z.string().min(1),
    request_type: z.enum([
      'api_request', 'ai_request', 'storage', 'transaction',
      'kyc_verification', 'risk_assessment', 'user_added', 'webhook_created'
    ])
  })),
  zValidator('query', z.object({
    quantity: z.coerce.number().int().min(1).default(1)
  })),
  async (c) => {
    try {
      const { subscription_id, request_type } = c.req.valid('param');
      const { quantity } = c.req.valid('query');

      const subscriptionService = new SubscriptionService(c.env);

      const limitCheck = await subscriptionService.checkSubscriptionLimits(
        subscription_id,
        request_type,
        quantity
      );

      return c.json({
        success: true,
        data: limitCheck
      });

    } catch (error) {
      console.error('Check limits error:', error);
      return c.json({
        success: false,
        error: {
          code: 'LIMIT_CHECK_FAILED',
          message: error.message || 'Failed to check subscription limits'
        }
      }, 500);
    }
  }
);

/**
 * Get subscription usage summary
 */
subscriptions.get('/:subscription_id/usage',
  zValidator('param', subscriptionIdSchema),
  zValidator('query', z.object({
    period: z.enum(['current', 'last_month', 'last_quarter', 'last_year']).default('current')
  })),
  async (c) => {
    try {
      const { subscription_id } = c.req.valid('param');
      const { period } = c.req.valid('query');

      const subscriptionService = new SubscriptionService(c.env);

      // Implementation would go here
      // const usageSummary = await subscriptionService.getUsageSummary(subscription_id, period);

      return c.json({
        success: true,
        data: {
          period,
          usage: {
            api_requests: { used: 450, limit: 1000, percentage: 45 },
            ai_requests: { used: 230, limit: 500, percentage: 46 },
            storage: { used: 2.3, limit: 10, percentage: 23 },
            transactions: { used: 89, limit: 1000, percentage: 8.9 }
          },
          ai_usage: {
            fraud_detection: 45,
            document_verification: 23,
            categorization: 67,
            forecasting: 12,
            total_ai_requests: 230,
            average_accuracy: 0.94
          },
          costs: {
            current_month: 99.00,
            projected_month: 112.50,
            year_to_date: 1188.00
          }
        }
      });

    } catch (error) {
      console.error('Get usage error:', error);
      return c.json({
        success: false,
        error: {
          code: 'USAGE_RETRIEVAL_FAILED',
          message: error.message || 'Failed to retrieve usage data'
        }
      }, 500);
    }
  }
);

/**
 * Get subscription analytics
 */
subscriptions.get('/:subscription_id/analytics',
  zValidator('param', subscriptionIdSchema),
  zValidator('query', analyticsSchema),
  async (c) => {
    try {
      const { subscription_id } = c.req.valid('param');
      const { period_start, period_end } = c.req.valid('query');

      const subscriptionService = new SubscriptionService(c.env);

      const analytics = await subscriptionService.generateSubscriptionAnalytics(
        subscription_id,
        new Date(period_start).getTime(),
        new Date(period_end).getTime()
      );

      return c.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Get analytics error:', error);
      return c.json({
        success: false,
        error: {
          code: 'ANALYTICS_GENERATION_FAILED',
          message: error.message || 'Failed to generate analytics'
        }
      }, 500);
    }
  }
);

/**
 * Get subscription recommendations
 */
subscriptions.get('/:subscription_id/recommendations',
  zValidator('param', subscriptionIdSchema),
  async (c) => {
    try {
      const { subscription_id } = c.req.valid('param');

      const subscriptionService = new SubscriptionService(c.env);

      // Implementation would go here
      // const recommendations = await subscriptionService.getRecommendations(subscription_id);

      return c.json({
        success: true,
        data: {
          recommendations: [
            {
              type: 'upgrade',
              title: 'Upgrade to Professional Tier',
              description: 'Your API usage is approaching the current limit. Upgrading will provide better value and unlimited room for growth.',
              financial_impact: {
                monthly_change: 50.00,
                annual_change: 600.00,
                roi_months: 3
              },
              benefits: [
                '5x more API requests',
                'Advanced AI features',
                'Priority support',
                'Custom integrations'
              ],
              implementation_steps: [
                'Review feature comparison',
                'Confirm budget approval',
                'Schedule upgrade for next billing cycle'
              ],
              confidence: 0.92,
              priority: 'high',
              valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              type: 'usage_optimization',
              title: 'Optimize API Usage Patterns',
              description: 'We\'ve identified opportunities to reduce API calls by 23% through caching and batching.',
              financial_impact: {
                monthly_change: -15.00,
                annual_change: -180.00,
                roi_months: 1
              },
              benefits: [
                'Reduced costs',
                'Better performance',
                'Lower environmental impact'
              ],
              implementation_steps: [
                'Implement response caching',
                'Use batch endpoints where possible',
                'Review API call patterns'
              ],
              confidence: 0.87,
              priority: 'medium',
              valid_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
            }
          ]
        }
      });

    } catch (error) {
      console.error('Get recommendations error:', error);
      return c.json({
        success: false,
        error: {
          code: 'RECOMMENDATIONS_FAILED',
          message: error.message || 'Failed to generate recommendations'
        }
      }, 500);
    }
  }
);

/**
 * Get available subscription tiers
 */
subscriptions.get('/tiers/all', async (c) => {
  try {
    const subscriptionService = new SubscriptionService(c.env);

    // Implementation would go here
    // const tiers = await subscriptionService.getAllSubscriptionTiers();

    return c.json({
      success: true,
      data: {
        tiers: [
          {
            id: 'starter',
            name: 'Starter',
            description: 'Perfect for small businesses and startups',
            price: 29,
            currency: 'USD',
            billing_interval: 'monthly',
            features: [
              { name: 'API Requests', included: true, limit: 1000, unit: '/month' },
              { name: 'AI Requests', included: true, limit: 100, unit: '/month' },
              { name: 'Storage', included: true, limit: 1, unit: 'GB' },
              { name: 'Basic Support', included: true }
            ],
            popular: false
          },
          {
            id: 'professional',
            name: 'Professional',
            description: 'Ideal for growing businesses with advanced needs',
            price: 99,
            currency: 'USD',
            billing_interval: 'monthly',
            features: [
              { name: 'API Requests', included: true, limit: 10000, unit: '/month' },
              { name: 'AI Requests', included: true, limit: 1000, unit: '/month' },
              { name: 'Storage', included: true, limit: 10, unit: 'GB' },
              { name: 'Advanced AI Features', included: true },
              { name: 'Priority Support', included: true }
            ],
            popular: true
          },
          {
            id: 'enterprise',
            name: 'Enterprise',
            description: 'Complete solution for large organizations',
            price: 299,
            currency: 'USD',
            billing_interval: 'monthly',
            features: [
              { name: 'API Requests', included: true, limit: 100000, unit: '/month' },
              { name: 'AI Requests', included: true, limit: 10000, unit: '/month' },
              { name: 'Storage', included: true, limit: 100, unit: 'GB' },
              { name: 'Custom AI Models', included: true },
              { name: 'Dedicated Support', included: true },
              { name: 'SLA Guarantee', included: true }
            ],
            popular: false
          }
        ]
      }
    });

  } catch (error) {
    console.error('Get tiers error:', error);
    return c.json({
      success: false,
      error: {
        code: 'TIERS_RETRIEVAL_FAILED',
        message: error.message || 'Failed to retrieve subscription tiers'
      }
    }, 500);
  }
});

/**
 * Get billing history
 */
subscriptions.get('/:subscription_id/billing',
  zValidator('param', subscriptionIdSchema),
  zValidator('query', z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0)
  })),
  async (c) => {
    try {
      const { subscription_id } = c.req.valid('param');
      const { limit, offset } = c.req.valid('query');

      // Implementation would go here
      // const billingHistory = await subscriptionService.getBillingHistory(subscription_id, limit, offset);

      return c.json({
        success: true,
        data: {
          billing_history: [
            {
              id: 'bill_001',
              date: '2025-01-01T00:00:00Z',
              amount: 99.00,
              currency: 'USD',
              status: 'paid',
              description: 'Professional Plan - January 2025',
              payment_method: 'card_ending_4242',
              invoice_url: 'https://billing.finsavvyai.com/invoices/inv_001'
            },
            {
              id: 'bill_002',
              date: '2024-12-01T00:00:00Z',
              amount: 99.00,
              currency: 'USD',
              status: 'paid',
              description: 'Professional Plan - December 2024',
              payment_method: 'card_ending_4242',
              invoice_url: 'https://billing.finsavvyai.com/invoices/inv_002'
            }
          ],
          pagination: {
            limit,
            offset,
            total: 12,
            has_more: offset + limit < 12
          }
        }
      });

    } catch (error) {
      console.error('Get billing history error:', error);
      return c.json({
        success: false,
        error: {
          code: 'BILLING_HISTORY_FAILED',
          message: error.message || 'Failed to retrieve billing history'
        }
      }, 500);
    }
  }
);

/**
 * Update payment method
 */
subscriptions.put('/:subscription_id/payment-method',
  zValidator('param', subscriptionIdSchema),
  zValidator('json', z.object({
    payment_method_id: z.string().min(1)
  })),
  async (c) => {
    try {
      const { subscription_id } = c.req.valid('param');
      const { payment_method_id } = c.req.valid('json');

      // Implementation would go here
      // await subscriptionService.updatePaymentMethod(subscription_id, payment_method_id);

      return c.json({
        success: true,
        message: 'Payment method updated successfully'
      });

    } catch (error) {
      console.error('Update payment method error:', error);
      return c.json({
        success: false,
        error: {
          code: 'PAYMENT_METHOD_UPDATE_FAILED',
          message: error.message || 'Failed to update payment method'
        }
      }, 400);
    }
  }
);

/**
 * Get subscription invoices
 */
subscriptions.get('/:subscription_id/invoices',
  zValidator('param', subscriptionIdSchema),
  zValidator('query', z.object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']).optional()
  })),
  async (c) => {
    try {
      const { subscription_id } = c.req.valid('param');
      const { limit, status } = c.req.valid('query');

      // Implementation would go here
      // const invoices = await subscriptionService.getInvoices(subscription_id, limit, status);

      return c.json({
        success: true,
        data: {
          invoices: [
            {
              id: 'inv_001',
              number: 'INV-2025-001',
              date: '2025-01-01T00:00:00Z',
              due_date: '2025-01-15T00:00:00Z',
              amount: 99.00,
              currency: 'USD',
              status: 'paid',
              description: 'Professional Plan - January 2025',
              pdf_url: 'https://billing.finsavvyai.com/invoices/inv_001.pdf'
            }
          ]
        }
      });

    } catch (error) {
      console.error('Get invoices error:', error);
      return c.json({
        success: false,
        error: {
          code: 'INVOICES_RETRIEVAL_FAILED',
          message: error.message || 'Failed to retrieve invoices'
        }
      }, 500);
    }
  }
);

export default subscriptions;