/**
 * Webhook handler routes using @finsavvyai/pay for signature verification
 */

import type { Hono } from 'hono';
import type {
  BillingEnv,
  StoredSubscription,
  WebhookEventData,
} from './billing-types';
import {
  WebhookHandler,
  type WebhookEvent,
} from '@finsavvyai/pay';

export function registerWebhookRoutes(
  app: Hono<{ Bindings: BillingEnv }>,
): void {
  app.post('/webhook', async (c) => {
    const body = await c.req.text();
    const env = c.env as any;

    try {
      const signature = c.req.header('X-Signature');
      if (!signature) {
        return c.json({
          success: false,
          error: 'Missing signature header',
        }, 401);
      }

      const webhookSecret = env.LEMONSQUEEZY_WEBHOOK_SECRET;

      if (!webhookSecret) {
        return c.json({
          success: false,
          error: 'Webhook security not configured',
          message:
            'Please set LEMONSQUEEZY_WEBHOOK_SECRET environment variable',
        }, 500);
      }

      // Use @finsavvyai/pay WebhookHandler for signature verification + parsing
      const webhookHandler = new WebhookHandler({
        provider: 'lemonsqueezy',
        secret: webhookSecret,
      });

      let event: WebhookEvent;
      try {
        event = await webhookHandler.handle(signature, body);
      } catch {
        return c.json({
          success: false,
          error: 'Invalid signature',
          message: 'Webhook signature verification failed',
        }, 401);
      }

      const rawEvent = JSON.parse(body);

      // Store webhook event for audit trail
      const webhookKey = `webhooks/${rawEvent.id || Date.now()}.json`;
      await env.BILLING_STORAGE.put(
        webhookKey,
        JSON.stringify({
          event: rawEvent,
          receivedAt: new Date().toISOString(),
          signature: 'verified',
        }),
      );

      // Route normalized event types to SDLC-specific handlers
      await routeWebhookEvent(event, rawEvent, env);

      return c.json({
        success: true,
        message: 'Webhook processed successfully',
        eventId: rawEvent.id,
      });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return c.json({
        success: false,
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });
}

// --- Route normalized events to SDLC storage handlers ---

async function routeWebhookEvent(
  event: WebhookEvent,
  rawEvent: WebhookEventData,
  env: BillingEnv,
): Promise<void> {
  switch (event.type) {
    case 'subscription.created':
    case 'subscription.updated':
      await handleSubscriptionChange(rawEvent, env);
      break;
    case 'subscription.cancelled':
      await handleSubscriptionCancellation(rawEvent, env);
      break;
    case 'payment.succeeded':
      await handlePaymentSuccess(rawEvent, env);
      break;
    default:
      console.log('Unhandled webhook event type:', event.type);
  }
}

async function handleSubscriptionChange(
  event: WebhookEventData,
  env: BillingEnv,
): Promise<void> {
  const subscription = event.data;
  const userId =
    subscription.attributes?.customer_email?.split('@')[0] ||
    'user_' + subscription.id;

  const subscriptionData = {
    id: subscription.id,
    userId,
    tier:
      subscription.attributes?.variant_name?.toLowerCase() || 'starter',
    status: subscription.attributes?.status || 'active',
    currentPeriodStart: subscription.attributes?.created_at,
    currentPeriodEnd: subscription.attributes?.renews_at,
    cancelAtPeriodEnd: subscription.attributes?.cancelled || false,
    lemonSqueezyId: subscription.id,
    updatedAt: new Date().toISOString(),
  };

  const subscriptionKey = `subscriptions/${userId}.json`;
  await env.BILLING_STORAGE.put(
    subscriptionKey,
    JSON.stringify(subscriptionData),
  );
}

async function handleSubscriptionCancellation(
  event: WebhookEventData,
  env: BillingEnv,
): Promise<void> {
  const subscription = event.data;
  const userId =
    subscription.attributes?.customer_email?.split('@')[0] ||
    'user_' + subscription.id;

  const subscriptionKey = `subscriptions/${userId}.json`;
  const existing = await env.BILLING_STORAGE.get(subscriptionKey);

  if (existing) {
    const subscriptionData = (await existing.json()) as StoredSubscription;
    subscriptionData.status = 'cancelled';
    subscriptionData.cancelledAt = new Date().toISOString();
    subscriptionData.cancelAtPeriodEnd = true;

    await env.BILLING_STORAGE.put(
      subscriptionKey,
      JSON.stringify(subscriptionData),
    );
  }
}

async function handlePaymentSuccess(
  event: WebhookEventData,
  env: BillingEnv,
): Promise<void> {
  const payment = event.data;
  const paymentKey = `payments/${payment.id}.json`;

  await env.BILLING_STORAGE.put(
    paymentKey,
    JSON.stringify({
      id: payment.id,
      amount: payment.attributes?.total,
      currency: payment.attributes?.currency,
      customerId: payment.attributes?.customer_id,
      subscriptionId: payment.attributes?.subscription_id,
      status: payment.attributes?.status,
      processedAt: new Date().toISOString(),
    }),
  );
}
