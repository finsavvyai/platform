/**
 * Shared types and middleware for the Unified Billing API
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface BillingEnv {
  BILLING_STORAGE: R2Bucket;
  ENVIRONMENT?: string;
  [key: string]: unknown;
}

/**
 * LemonSqueezy webhook payloads model subscriptions and payments inside
 * `data.attributes`. The fields below are the subset SDLC billing handlers
 * read; additional provider fields are allowed but untyped.
 */
export interface LemonSqueezyAttributes {
  customer_email?: string;
  customer_id?: string | number;
  subscription_id?: string | number;
  variant_name?: string;
  status?: string;
  created_at?: string;
  renews_at?: string;
  cancelled?: boolean;
  total?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface LemonSqueezyEventResource {
  id: string;
  attributes?: LemonSqueezyAttributes;
  [key: string]: unknown;
}

export interface WebhookEventData {
  id: string;
  data: LemonSqueezyEventResource;
  attributes?: Record<string, unknown>;
}

/**
 * Subscription records persisted in R2 by SDLC billing handlers. The shape
 * is our own storage format, not the provider's wire format.
 */
export interface StoredSubscription {
  id: string;
  userId: string;
  tier: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string;
  endsAt?: string;
  lemonSqueezyId?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface HonoContext {
  req: { header: (name: string) => string | undefined };
  json: (data: unknown, status?: number) => Response;
}

export const TIER_LIMITS = {
  starter: { products: 3, apiRequests: 10000, users: 1, storage: '1GB' },
  pro: { products: 8, apiRequests: 100000, users: 5, storage: '10GB' },
  enterprise: {
    products: 'unlimited',
    apiRequests: 1000000,
    users: 'unlimited',
    storage: 'unlimited',
  },
} as const;

export const TIER_PRICING = {
  starter: 29,
  pro: 99,
  enterprise: 299,
} as const;

export const TIERS_LIST = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    interval: 'month',
    features: [
      'Up to 3 products',
      '10,000 API requests/month',
      'Basic support',
      '1 user account',
    ],
    limits: TIER_LIMITS.starter,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    interval: 'month',
    features: [
      'Up to 8 products',
      '100,000 API requests/month',
      'Priority support',
      '5 user accounts',
      'Advanced analytics',
    ],
    limits: TIER_LIMITS.pro,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    interval: 'month',
    features: [
      'Unlimited products',
      '1M+ API requests/month',
      '24/7 dedicated support',
      'Unlimited users',
      'Custom integrations',
      'SLA guarantee',
    ],
    limits: TIER_LIMITS.enterprise,
  },
];

/**
 * Basic authentication check function
 */
export function validateAuth(c: HonoContext): {
  success: boolean;
  userId?: string;
  error?: Response;
} {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: c.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'Please provide a valid Bearer token',
        },
        401,
      ),
    };
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token || token.length < 10) {
    return {
      success: false,
      error: c.json(
        {
          success: false,
          error: 'Invalid token',
          message: 'Authentication token is invalid or expired',
        },
        401,
      ),
    };
  }

  const userId = token.includes('cus_')
    ? token
    : `user_${token.slice(0, 8)}`;

  return { success: true, userId };
}

/**
 * Create the Hono app with CORS middleware
 */
export function createBillingApp(): Hono<{ Bindings: BillingEnv }> {
  const app = new Hono<{ Bindings: BillingEnv }>();

  app.use(
    '/*',
    cors({
      origin: [
        'https://billing.finsavvyai.com',
        'https://finsavvyai.com',
      ],
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Signature'],
    }),
  );

  return app;
}
