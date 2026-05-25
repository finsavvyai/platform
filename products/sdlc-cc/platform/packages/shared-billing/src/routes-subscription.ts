/**
 * Subscription routes: get, upgrade, cancel
 */

import type { Hono } from 'hono';
import type { BillingEnv, StoredSubscription } from './billing-types';
import { validateAuth, TIER_LIMITS, TIERS_LIST } from './billing-types';

export function registerSubscriptionRoutes(
  app: Hono<{ Bindings: BillingEnv }>,
): void {
  // Get subscription tiers
  app.get('/tiers', (c) => {
    return c.json({ success: true, data: TIERS_LIST });
  });

  // Get subscription status
  app.get('/subscription/:userId', async (c) => {
    const paramUserId = c.req.param('userId');
    const env = c.env as any;

    const auth = validateAuth(c);
    if (!auth.success) return auth.error;

    if (paramUserId !== auth.userId && !paramUserId.startsWith('user_')) {
      return c.json({
        success: false,
        error: 'Access denied',
        message: 'You can only access your own subscription data',
      }, 403);
    }

    const userId = auth.userId || paramUserId;

    try {
      const subscriptionKey = `subscriptions/${userId}.json`;
      const subscriptionObject = await env.BILLING_STORAGE.get(subscriptionKey);

      if (subscriptionObject) {
        const subscriptionData = await subscriptionObject.json();
        return c.json({ success: true, data: subscriptionData });
      }

      const defaultSubscription = {
        id: `sub_${Date.now()}`,
        userId,
        tier: 'starter',
        status: 'trial',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        cancelAtPeriodEnd: false,
        usage: { apiRequests: 0, storage: '0MB', users: 1 },
        limits: { apiRequests: 10000, storage: '1GB', users: 1 },
      };

      await env.BILLING_STORAGE.put(
        subscriptionKey,
        JSON.stringify(defaultSubscription),
      );

      return c.json({ success: true, data: defaultSubscription });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to fetch subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  // Upgrade/Change subscription tier
  app.post('/subscription/:userId/upgrade', async (c) => {
    try {
      const userId = c.req.param('userId');
      const env = c.env;
      const body = await c.req.json();
      const { newTier } = body;

      if (!['starter', 'pro', 'enterprise'].includes(newTier)) {
        return c.json({ success: false, error: 'Invalid tier' }, 400);
      }

      const subscriptionKey = `subscriptions/${userId}.json`;
      const subscriptionObject = await env.BILLING_STORAGE.get(subscriptionKey);

      let subscription: StoredSubscription;
      if (subscriptionObject) {
        subscription = (await subscriptionObject.json()) as StoredSubscription;
      } else {
        subscription = {
          id: `sub_${Date.now()}`,
          userId,
          tier: 'starter',
          status: 'trial',
        };
      }

      subscription.tier = newTier;
      subscription.status =
        subscription.status === 'trial' ? 'active' : subscription.status;
      subscription.currentPeriodStart = new Date().toISOString();
      subscription.currentPeriodEnd = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      subscription.limits =
        TIER_LIMITS[newTier as keyof typeof TIER_LIMITS];
      subscription.cancelAtPeriodEnd = false;

      await env.BILLING_STORAGE.put(
        subscriptionKey,
        JSON.stringify(subscription),
      );

      return c.json({ success: true, data: subscription });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to upgrade subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  // Cancel subscription
  app.post('/subscription/:userId/cancel', async (c) => {
    try {
      const userId = c.req.param('userId');
      const env = c.env;
      const body = await c.req.json();
      const immediate = body.immediate || false;

      const subscriptionKey = `subscriptions/${userId}.json`;
      const subscriptionObject = await env.BILLING_STORAGE.get(subscriptionKey);

      if (!subscriptionObject) {
        return c.json(
          { success: false, error: 'Subscription not found' },
          404,
        );
      }

      const subscription = (await subscriptionObject.json()) as StoredSubscription;

      subscription.cancelAtPeriodEnd = true;
      if (immediate) {
        subscription.status = 'cancelled';
        subscription.cancelledAt = new Date().toISOString();
        subscription.endsAt = new Date().toISOString();
      } else {
        subscription.status = 'active_until_period_end';
        subscription.endsAt = subscription.currentPeriodEnd;
      }

      await env.BILLING_STORAGE.put(
        subscriptionKey,
        JSON.stringify(subscription),
      );

      return c.json({
        success: true,
        data: {
          subscriptionId: subscription.id,
          status: subscription.status,
          cancelledAt: subscription.cancelledAt,
          endsAt: subscription.endsAt,
        },
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to cancel subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });
}
