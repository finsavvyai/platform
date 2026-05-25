/**
 * Analytics and checkout routes
 */

import type { Hono } from 'hono';
import type { BillingEnv } from './billing-types';
import { TIER_PRICING } from './billing-types';

export function registerAnalyticsRoutes(
  app: Hono<{ Bindings: BillingEnv }>,
): void {
  // Create checkout session
  app.post('/checkout', async (c) => {
    try {
      const sessionId = `lemonsqueezy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return c.json({
        success: true,
        data: {
          sessionId,
          url: `https://billing.finsavvyai.com/success?session_id=${sessionId}`,
          cancelUrl: 'https://billing.finsavvyai.com/cancel',
          expiresAt: new Date(
            Date.now() + 30 * 60 * 1000,
          ).toISOString(),
        },
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to create checkout session',
        message:
          error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

  // Get billing analytics
  app.get('/analytics/:userId', async (c) => {
    const userId = c.req.param('userId');
    const env = c.env as any;

    try {
      const subscriptionKey = `subscriptions/${userId}.json`;
      const subscriptionObject =
        await env.BILLING_STORAGE.get(subscriptionKey);

      if (!subscriptionObject) {
        return c.json(
          { success: false, error: 'Subscription not found' },
          404,
        );
      }

      const subscription = await subscriptionObject.json();

      const analyticsKey = `analytics/${userId}.json`;
      const analyticsObject =
        await env.BILLING_STORAGE.get(analyticsKey);

      let analytics;
      if (analyticsObject) {
        analytics = await analyticsObject.json();
      } else {
        analytics = {
          currentMonth: {
            revenue: 0,
            usage: {
              apiRequests: 0,
              storage: '0MB',
              bandwidth: '0GB',
            },
          },
          trends: { revenue: [], usage: [] },
          subscriptionHistory: [],
        };
      }

      const currentMonthRevenue =
        TIER_PRICING[
          subscription.tier as keyof typeof TIER_PRICING
        ] || 0;
      analytics.currentMonth.revenue = currentMonthRevenue;
      analytics.currentMonth.usage = subscription.usage || {
        apiRequests: 0,
        storage: '0MB',
        bandwidth: '0GB',
      };

      await env.BILLING_STORAGE.put(
        analyticsKey,
        JSON.stringify(analytics),
      );

      return c.json({ success: true, data: analytics });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to fetch analytics',
        message:
          error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });
}
