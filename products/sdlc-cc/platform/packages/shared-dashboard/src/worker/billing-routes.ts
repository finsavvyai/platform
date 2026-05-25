/**
 * Billing Routes for AutoBoot Framework
 * LemonSqueezy Integration Endpoints
 */

import { Hono } from 'hono';
import './types';
import { requireAuth } from './auth-secure';
import type { User } from './auth-secure';
import {
  LemonSqueezyClient,
  syncSubscription,
  getCustomerSubscriptions,
  recordUsage,
  getUsageSummary,
  verifyWebhookSignature,
  type LemonSqueezyWebhookEvent,
} from './billing-service';

interface Env {
  DASHBOARD_DB: D1Database;
  LEMONSQUEEZY_API_KEY?: string;
  LEMONSQUEEZY_STORE_ID?: string;
  LEMONSQUEEZY_WEBHOOK_SECRET?: string;
}

const billingRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/billing/subscriptions
 * Get current user's subscriptions
 */
billingRoutes.get('/subscriptions', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;

    const subscriptions = await getCustomerSubscriptions(
      c.env.DASHBOARD_DB,
      user.id
    );

    return c.json({
      subscriptions,
      count: subscriptions.length,
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    return c.json({
      error: 'Failed to retrieve subscriptions',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/v1/billing/checkout
 * Create checkout session for a product
 */
billingRoutes.post('/checkout', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const { variantId, successUrl, cancelUrl } = await c.req.json();

    if (!variantId) {
      return c.json({
        error: 'Invalid request',
        message: 'variantId is required',
      }, 400);
    }

    const apiKey = c.env.LEMONSQUEEZY_API_KEY;
    const storeId = c.env.LEMONSQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return c.json({
        error: 'Configuration error',
        message: 'LemonSqueezy is not configured',
      }, 500);
    }

    const ls = new LemonSqueezyClient(apiKey);

    // Create checkout with custom data
    const checkoutUrl = await ls.createCheckout(storeId, variantId, {
      user_id: user.id,
      user_email: user.email,
      user_name: user.name,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return c.json({
      checkoutUrl,
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    return c.json({
      error: 'Failed to create checkout',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/billing/subscriptions/:id
 * Get subscription details
 */
billingRoutes.get('/subscriptions/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const subscriptionId = c.req.param('id');

    const result = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        s.id,
        s.lemonsqueezy_subscription_id,
        s.product_name,
        s.variant_name,
        s.status,
        s.trial_ends_at,
        s.billing_anchor,
        s.renews_at,
        s.ends_at,
        s.cancelled_at,
        s.card_brand,
        s.card_last_four,
        s.update_payment_method_url,
        s.urls,
        s.metadata,
        s.created_at,
        c.user_id
      FROM billing_subscriptions s
      INNER JOIN billing_customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).bind(subscriptionId).first();

    if (!result) {
      return c.json({
        error: 'Not found',
        message: 'Subscription not found',
      }, 404);
    }

    // Verify user owns this subscription
    if (result.user_id !== user.id) {
      return c.json({
        error: 'Forbidden',
        message: 'Access denied',
      }, 403);
    }

    return c.json({
      subscription: {
        id: result.id,
        lemonSqueezyId: result.lemonsqueezy_subscription_id,
        productName: result.product_name,
        variantName: result.variant_name,
        status: result.status,
        trialEndsAt: result.trial_ends_at,
        billingAnchor: result.billing_anchor,
        renewsAt: result.renews_at,
        endsAt: result.ends_at,
        cancelledAt: result.cancelled_at,
        cardBrand: result.card_brand,
        cardLastFour: result.card_last_four,
        updatePaymentMethodUrl: result.update_payment_method_url,
        urls: JSON.parse(result.urls as string || '{}'),
        metadata: JSON.parse(result.metadata as string || '{}'),
        createdAt: result.created_at,
      },
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return c.json({
      error: 'Failed to retrieve subscription',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * PUT /api/v1/billing/subscriptions/:id
 * Update subscription (pause, resume, cancel)
 */
billingRoutes.put('/subscriptions/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const subscriptionId = c.req.param('id');
    const { action, variantId } = await c.req.json();

    // Get subscription and verify ownership
    const result = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        s.lemonsqueezy_subscription_id,
        c.user_id
      FROM billing_subscriptions s
      INNER JOIN billing_customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).bind(subscriptionId).first();

    if (!result) {
      return c.json({
        error: 'Not found',
        message: 'Subscription not found',
      }, 404);
    }

    if (result.user_id !== user.id) {
      return c.json({
        error: 'Forbidden',
        message: 'Access denied',
      }, 403);
    }

    const apiKey = c.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      return c.json({
        error: 'Configuration error',
        message: 'LemonSqueezy is not configured',
      }, 500);
    }

    const ls = new LemonSqueezyClient(apiKey);
    const lsSubscriptionId = result.lemonsqueezy_subscription_id as string;

    let updatedSubscription;

    switch (action) {
      case 'pause':
        updatedSubscription = await ls.updateSubscription(lsSubscriptionId, {
          pause: { mode: 'void' },
        });
        break;

      case 'resume':
        updatedSubscription = await ls.updateSubscription(lsSubscriptionId, {
          pause: null as any,
        });
        break;

      case 'cancel':
        updatedSubscription = await ls.cancelSubscription(lsSubscriptionId);
        break;

      case 'change_plan':
        if (!variantId) {
          return c.json({
            error: 'Invalid request',
            message: 'variantId is required for plan change',
          }, 400);
        }
        updatedSubscription = await ls.updateSubscription(lsSubscriptionId, {
          variant_id: parseInt(variantId),
        });
        break;

      default:
        return c.json({
          error: 'Invalid action',
          message: 'Action must be: pause, resume, cancel, or change_plan',
        }, 400);
    }

    // Sync updated subscription to database
    const customer = await c.env.DASHBOARD_DB.prepare(`
      SELECT c.id
      FROM billing_customers c
      INNER JOIN billing_subscriptions s ON s.customer_id = c.id
      WHERE s.id = ?
    `).bind(subscriptionId).first();

    if (customer) {
      await syncSubscription(c.env.DASHBOARD_DB, customer.id as string, updatedSubscription);
    }

    return c.json({
      success: true,
      message: `Subscription ${action} successful`,
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    return c.json({
      error: 'Failed to update subscription',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/v1/billing/usage/record
 * Record usage for metered billing
 */
billingRoutes.post('/usage/record', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const { subscriptionId, subscriptionItemId, quantity, action } = await c.req.json();

    if (!subscriptionId || !subscriptionItemId || !quantity) {
      return c.json({
        error: 'Invalid request',
        message: 'subscriptionId, subscriptionItemId, and quantity are required',
      }, 400);
    }

    // Verify user owns this subscription
    const result = await c.env.DASHBOARD_DB.prepare(`
      SELECT c.user_id
      FROM billing_subscriptions s
      INNER JOIN billing_customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).bind(subscriptionId).first();

    if (!result) {
      return c.json({
        error: 'Not found',
        message: 'Subscription not found',
      }, 404);
    }

    if (result.user_id !== user.id) {
      return c.json({
        error: 'Forbidden',
        message: 'Access denied',
      }, 403);
    }

    await recordUsage(
      c.env.DASHBOARD_DB,
      subscriptionId,
      subscriptionItemId,
      quantity,
      action || 'increment'
    );

    return c.json({
      success: true,
      message: 'Usage recorded successfully',
    });
  } catch (error) {
    console.error('Record usage error:', error);
    return c.json({
      error: 'Failed to record usage',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/billing/usage/:subscriptionId
 * Get usage summary for a subscription
 */
billingRoutes.get('/usage/:subscriptionId', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const subscriptionId = c.req.param('subscriptionId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Verify user owns this subscription
    const result = await c.env.DASHBOARD_DB.prepare(`
      SELECT c.user_id
      FROM billing_subscriptions s
      INNER JOIN billing_customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).bind(subscriptionId).first();

    if (!result) {
      return c.json({
        error: 'Not found',
        message: 'Subscription not found',
      }, 404);
    }

    if (result.user_id !== user.id) {
      return c.json({
        error: 'Forbidden',
        message: 'Access denied',
      }, 403);
    }

    const usage = await getUsageSummary(
      c.env.DASHBOARD_DB,
      subscriptionId,
      startDate,
      endDate
    );

    return c.json({
      subscriptionId,
      total: usage.total,
      records: usage.records,
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error('Get usage error:', error);
    return c.json({
      error: 'Failed to retrieve usage',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/billing/invoices
 * Get customer's invoices
 */
billingRoutes.get('/invoices', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const limit = parseInt(c.req.query('limit') || '20');

    const { results } = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        i.id,
        i.lemonsqueezy_invoice_id,
        i.invoice_number,
        i.status,
        i.subtotal,
        i.discount_total,
        i.tax_total,
        i.total,
        i.currency,
        i.invoice_url,
        i.pdf_url,
        i.due_date,
        i.paid_at,
        i.created_at
      FROM billing_invoices i
      INNER JOIN billing_customers c ON i.customer_id = c.id
      WHERE c.user_id = ?
      ORDER BY i.created_at DESC
      LIMIT ?
    `).bind(user.id, limit).all();

    return c.json({
      invoices: results.map(invoice => ({
        id: invoice.id,
        lemonSqueezyId: invoice.lemonsqueezy_invoice_id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        subtotal: invoice.subtotal,
        discountTotal: invoice.discount_total,
        taxTotal: invoice.tax_total,
        total: invoice.total,
        currency: invoice.currency,
        invoiceUrl: invoice.invoice_url,
        pdfUrl: invoice.pdf_url,
        dueDate: invoice.due_date,
        paidAt: invoice.paid_at,
        createdAt: invoice.created_at,
      })),
      count: results.length,
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return c.json({
      error: 'Failed to retrieve invoices',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/v1/webhooks/lemonsqueezy
 * Handle LemonSqueezy webhooks
 */
billingRoutes.post('/webhooks/lemonsqueezy', async (c) => {
  try {
    const signature = c.req.header('X-Signature');
    const rawBody = await c.req.text();

    // Verify webhook signature
    const webhookSecret = c.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        return c.json({
          error: 'Invalid signature',
          message: 'Webhook signature verification failed',
        }, 401);
      }
    }

    const event: LemonSqueezyWebhookEvent = JSON.parse(rawBody);

    // Log webhook event
    const eventId = crypto.randomUUID();
    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO billing_webhook_events (
        id, lemonsqueezy_event_id, event_type, payload
      ) VALUES (?, ?, ?, ?)
    `).bind(
      eventId,
      event.meta.webhook_id,
      event.meta.event_name,
      rawBody
    ).run();

    // Process webhook based on event type
    switch (event.meta.event_name) {
      case 'subscription_created':
      case 'subscription_updated':
        // Sync subscription to database
        const customData = event.meta.custom_data;
        if (customData && customData.user_id) {
          // Find or create customer
          const customer = await c.env.DASHBOARD_DB.prepare(`
            SELECT id FROM billing_customers WHERE user_id = ?
          `).bind(customData.user_id).first();

          if (customer) {
            await syncSubscription(
              c.env.DASHBOARD_DB,
              customer.id as string,
              event.data as any
            );
          }
        }
        break;

      case 'subscription_cancelled':
      case 'subscription_expired':
        // Update subscription status
        await c.env.DASHBOARD_DB.prepare(`
          UPDATE billing_subscriptions
          SET
            status = ?,
            cancelled_at = datetime('now'),
            updated_at = datetime('now')
          WHERE lemonsqueezy_subscription_id = ?
        `).bind(
          event.data.attributes.status,
          event.data.id
        ).run();
        break;

      case 'order_created':
        // Handle one-time purchases
        console.log('Order created:', event.data.id);
        break;

      default:
        console.log('Unhandled webhook event:', event.meta.event_name);
    }

    // Mark event as processed
    await c.env.DASHBOARD_DB.prepare(`
      UPDATE billing_webhook_events
      SET processed = 1, processed_at = datetime('now')
      WHERE id = ?
    `).bind(eventId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);

    // Log error but return 200 to prevent retries
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default billingRoutes;
