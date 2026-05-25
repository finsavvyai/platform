/**
 * Billing and payment API routes for Wave 1.
 * Handles checkout, webhook processing, and subscription status.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { PaymentProvider } from '../payment/types.js';
import { isValidPlan } from '../payment/plans.js';
import { handleSubscriptionEvent } from '../payment/webhook.js';
import { getSubscription, createSubscription } from '../db/queries.js';
import type { TokenPayload } from '../auth/types.js';

const CheckoutSchema = z.object({
  planId: z.enum(['free', 'pro', 'enterprise']),
});

export const createBillingRoutes = (paymentProvider: PaymentProvider) => {
  const router = new Hono();

  // POST /api/checkout
  router.post('/checkout', async (c: Context) => {
    try {
      const user = c.get('user') as TokenPayload | undefined;
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const raw = await c.req.json().catch(() => null);
      const parsed = CheckoutSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ error: 'Invalid input', message: parsed.error.issues[0]?.message ?? 'Validation failed' }, 400);
      }
      const { planId } = parsed.data;

      if (!isValidPlan(planId)) {
        return c.json({ error: 'Invalid plan' }, 400);
      }

      const session = await paymentProvider.createCheckout(planId, user.userId);
      return c.json(session);
    } catch {
      return c.json({ error: 'Checkout failed' }, 400);
    }
  });

  // POST /api/webhooks/payment
  router.post('/webhooks/payment', async (c: Context) => {
    try {
      const signature = c.req.header('x-signature');
      if (!signature) {
        return c.json({ error: 'Missing signature' }, 401);
      }

      const body = await c.req.text();
      const event = await paymentProvider.handleWebhook(signature, body);

      const subscriptionEvent = await handleSubscriptionEvent(c.var.db, event);
      if (subscriptionEvent) {
        await getSubscription(c.var.db, subscriptionEvent.userId);
      }

      return c.json({ success: true });
    } catch {
      return c.json(
        { error: 'Webhook processing failed' },
        400,
      );
    }
  });

  // GET /api/billing
  router.get('/billing', async (c: Context) => {
    try {
      const user = c.get('user') as TokenPayload | undefined;
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      let subscription = await getSubscription(c.var.db, user.userId);

      if (!subscription) {
        subscription = await createSubscription(c.var.db, {
          user_id: user.userId,
          plan: 'free',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
      }

      const plan = paymentProvider.getPlan(subscription.plan);

      return c.json({
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          expiresAt: subscription.expires_at,
        },
        planDetails: plan,
      });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Billing lookup failed' },
        400,
      );
    }
  });

  return router;
};
