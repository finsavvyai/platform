import { Request, Response } from 'express';
import { z } from 'zod';
import { lemonSqueezyService } from '../services/LemonSqueezyService.js';
import { db } from '../lib/db.js';
import { users, subscriptions } from '../schema/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const createCheckoutSchema = z.object({
  variantId: z.string(),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional()
});

const webhookEventSchema = z.object({
  meta: z.object({
    event_name: z.string(),
    custom_data: z.record(z.any()).optional()
  }),
  data: z.object({
    id: z.string(),
    type: z.string(),
    attributes: z.record(z.any()),
    relationships: z.record(z.any()).optional()
  })
});

export const createCheckout = async (req: Request, res: Response) => {
  try {
    const validatedData = createCheckoutSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = req.user!;

    const checkout = await lemonSqueezyService.createCheckout({
      variantId: validatedData.variantId,
      userId: userId,
      userEmail: user.email,
      userName: user.firstName || user.email,
      successUrl: validatedData.successUrl,
      cancelUrl: validatedData.cancelUrl,
      customData: {
        user_id: userId,
        team_id: user.teamId
      }
    });

    res.json({
      id: checkout.id,
      url: checkout.url,
      expires_at: checkout.expires_at
    });
  } catch (error) {
    logger.error('Failed to create checkout:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create checkout session'
    });
  }
};

export const getSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get subscription from our database
    const [subscription] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      return res.json({ subscription: null });
    }

    // Get latest subscription details from LemonSqueezy if available
    if (subscription.stripeSubscriptionId) {
      const lemonSqueezySubscription = await lemonSqueezyService.getSubscription(
        subscription.stripeSubscriptionId
      );

      if (lemonSqueezySubscription) {
        // Update local database with latest info
        await db.update(subscriptions)
          .set({
            status: lemonSqueezySubscription.status,
            currentPeriodStart: new Date(lemonSqueezySubscription.current_period_start),
            currentPeriodEnd: new Date(lemonSqueezySubscription.current_period_end),
            cancelAtPeriodEnd: lemonSqueezySubscription.cancel_at_period_end,
            updatedAt: new Date()
          })
          .where(eq(subscriptions.id, subscription.id));

        return res.json({
          subscription: lemonSqueezySubscription
        });
      }
    }

    res.json({ subscription });
  } catch (error) {
    logger.error('Failed to get subscription:', error);
    res.status(500).json({
      error: 'Failed to retrieve subscription'
    });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [subscription] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const success = await lemonSqueezyService.cancelSubscription(
      subscription.stripeSubscriptionId,
      true // Cancel at period end
    );

    if (success) {
      await db.update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, subscription.id));

      res.json({
        success: true,
        message: 'Subscription will be cancelled at the end of the current period'
      });
    } else {
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  } catch (error) {
    logger.error('Failed to cancel subscription:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription'
    });
  }
};

export const resumeSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [subscription] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const success = await lemonSqueezyService.updateSubscription(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: false
      }
    );

    if (success) {
      await db.update(subscriptions)
        .set({
          cancelAtPeriodEnd: false,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, subscription.id));

      res.json({
        success: true,
        message: 'Subscription resumed successfully'
      });
    } else {
      res.status(500).json({ error: 'Failed to resume subscription' });
    }
  } catch (error) {
    logger.error('Failed to resume subscription:', error);
    res.status(500).json({
      error: 'Failed to resume subscription'
    });
  }
};

export const getCustomerPortalUrl = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [subscription] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const portalUrl = await lemonSqueezyService.getCustomerPortalUrl(
      subscription.stripeSubscriptionId
    );

    if (portalUrl) {
      res.json({ url: portalUrl });
    } else {
      // Fallback to LemonSqueezy's general customer portal
      const storeUrl = process.env.VITE_LEMONSQUEEZY_STORE_URL || 'https://questro.lemonsqueezy.com';
      res.json({ url: `${storeUrl}/billing` });
    }
  } catch (error) {
    logger.error('Failed to get customer portal URL:', error);
    res.status(500).json({
      error: 'Failed to get customer portal URL'
    });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-signature'] as string;
    const payload = JSON.stringify(req.body);

    if (!lemonSqueezyService.verifyWebhookSignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = webhookEventSchema.parse(req.body);

    await lemonSqueezyService.handleWebhook(event as any);

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Listen to LemonSqueezy service events to update local database
lemonSqueezyService.on('subscription:created', async (subscription: any) => {
  try {
    logger.info('Processing subscription created event', { subscriptionId: subscription.id });

    await db.insert(subscriptions).values({
      userId: subscription.user_id,
      planId: getPlanFromVariantId(subscription.variant_id),
      status: subscription.status,
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(subscription.current_period_start),
      currentPeriodEnd: new Date(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    logger.error('Failed to create subscription in database:', error);
  }
});

lemonSqueezyService.on('subscription:updated', async (subscription: any) => {
  try {
    logger.info('Processing subscription updated event', { subscriptionId: subscription.id });

    await db.update(subscriptions)
      .set({
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start),
        currentPeriodEnd: new Date(subscription.current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  } catch (error) {
    logger.error('Failed to update subscription in database:', error);
  }
});

lemonSqueezyService.on('subscription:cancelled', async (subscription: any) => {
  try {
    logger.info('Processing subscription cancelled event', { subscriptionId: subscription.id });

    await db.update(subscriptions)
      .set({
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  } catch (error) {
    logger.error('Failed to update cancelled subscription in database:', error);
  }
});

lemonSqueezyService.on('subscription:expired', async (subscription: any) => {
  try {
    logger.info('Processing subscription expired event', { subscriptionId: subscription.id });

    await db.update(subscriptions)
      .set({
        status: 'expired',
        updatedAt: new Date()
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  } catch (error) {
    logger.error('Failed to update expired subscription in database:', error);
  }
});

function getPlanFromVariantId(variantId: string): string {
  const proVariantId = process.env.LEMONSQUEEZY_VARIANT_ID_PRO;
  const enterpriseVariantId = process.env.LEMONSQUEEZY_VARIANT_ID_ENTERPRISE;

  if (variantId === proVariantId) return 'pro';
  if (variantId === enterpriseVariantId) return 'enterprise';

  return 'free'; // Default fallback
}