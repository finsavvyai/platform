import { Router } from 'express';
import crypto from 'crypto';
import { lemonSqueezyService } from '../../services/LemonSqueezyService.js';
import { DatabaseService } from '../../services/DatabaseService.js';
import { emailService } from '../../services/EmailService.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// Initialize services
const db = DatabaseService.getInstance();

/**
 * Verify Lemon Squeezy webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const signingSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!signingSecret) {
    logger.warn('LemonSqueezy webhook secret not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', signingSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Main webhook endpoint for Lemon Squeezy
 */
router.post('/lemonsqueezy', async (req, res) => {
  try {
    const signature = req.headers['x-lemonsqueezy-signature'] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      logger.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    const eventName = event.meta.event_name;

    logger.info(`🍋 Lemon Squeezy Webhook: ${eventName}`, {
      id: event.data?.id,
      type: event.data?.type
    });

    // Process the webhook event
    await processWebhookEvent(eventName, event.data);

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Process individual webhook events
 */
async function processWebhookEvent(eventName: string, eventData: any): Promise<void> {
  const attributes = eventData.attributes;
  const customData = attributes.custom_data || {};
  const customerEmail = attributes.customer_email || attributes.user_email;
  const customerName = attributes.user_name || customerEmail?.split('@')[0];

  switch (eventName) {
    case 'order_created':
      await handleOrderCreated(eventData, customerEmail, customerName, customData);
      break;

    case 'order_refunded':
      await handleOrderRefunded(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_created':
      await handleSubscriptionCreated(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_updated':
      await handleSubscriptionUpdated(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_cancelled':
      await handleSubscriptionCancelled(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_resumed':
      await handleSubscriptionResumed(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_expired':
      await handleSubscriptionExpired(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_paused':
      await handleSubscriptionPaused(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_unpaused':
      await handleSubscriptionUnpaused(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_payment_success':
      await handlePaymentSuccess(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_payment_failed':
      await handlePaymentFailed(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_payment_refunded':
      await handlePaymentRefunded(eventData, customerEmail, customerName, customData);
      break;

    case 'subscription_payment_recovered':
      await handlePaymentRecovered(eventData, customerEmail, customerName, customData);
      break;

    default:
      logger.warn(`Unhandled Lemon Squeezy event: ${eventName}`);
  }
}

/**
 * Handle one-time order creation (e.g., early access, lifetime deals)
 */
async function handleOrderCreated(
  eventData: any,
  customerEmail: string,
  customerName: string,
  customData: any
): Promise<void> {
  try {
    const { id: orderId, attributes } = eventData;
    const { total, currency, variant_id } = attributes;

    logger.info(`💰 Order created: ${orderId}`, {
      customerEmail,
      total,
      currency,
      variantId: variant_id
    });

    // Determine subscription tier from variant
    const tier = determineTierFromVariant(variant_id);
    const limits = getTierLimits(tier);

    // Create or update user record
    await db.query(`
      INSERT INTO users (email, name, subscription_tier, access_level, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        subscription_tier = EXCLUDED.subscription_tier,
        access_level = EXCLUDED.access_level,
        updated_at = NOW()
    `, [customerEmail, customerName, tier, tier === 'early_access' ? 'lifetime' : 'active']);

    // Record the order
    await db.query(`
      INSERT INTO orders (
        order_id, user_email, customer_name, amount, currency,
        subscription_tier, variant_id, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
    `, [orderId, customerEmail, customerName, total, currency, tier, variant_id]);

    // Send welcome email using autoboot-style service
    await emailService.sendWelcomeEmail(customerEmail, customerName, tier);

    // Track conversion
    await trackConversion('order_created', customerEmail, {
      orderId,
      tier,
      total,
      currency,
      variantId: variant_id
    });

    // Emit event for real-time updates
    lemonSqueezyService.emit('order:created', {
      orderId,
      customerEmail,
      tier,
      total,
      currency
    });

  } catch (error) {
    logger.error('Error handling order_created:', error);
    throw error;
  }
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(
  eventData: any,
  customerEmail: string,
  customerName: string,
  customData: any
): Promise<void> {
  try {
    const { id: subscriptionId, attributes } = eventData;
    const {
      variant_id,
      status,
      current_period_start,
      current_period_end,
      trial_ends_at,
      ends_at
    } = attributes;

    logger.info(`🔄 Subscription created: ${subscriptionId}`, {
      customerEmail,
      variantId: variant_id,
      status
    });

    // Determine subscription tier
    const tier = determineTierFromVariant(variant_id);
    const limits = getTierLimits(tier);

    // Update or create user subscription
    await db.query(`
      INSERT INTO user_subscriptions (
        subscription_id, user_email, customer_name, subscription_tier,
        variant_id, status, current_period_start, current_period_end,
        trial_end, cancel_at_period_end, limits, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      ON CONFLICT (subscription_id)
      DO UPDATE SET
        user_email = EXCLUDED.user_email,
        customer_name = EXCLUDED.customer_name,
        subscription_tier = EXCLUDED.subscription_tier,
        variant_id = EXCLUDED.variant_id,
        status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        trial_end = EXCLUDED.trial_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        limits = EXCLUDED.limits,
        updated_at = NOW()
    `, [
      subscriptionId,
      customerEmail,
      customerName,
      tier,
      variant_id,
      status,
      new Date(current_period_start),
      new Date(current_period_end),
      trial_ends_at ? new Date(trial_ends_at) : null,
      !!ends_at,
      JSON.stringify(limits)
    ]);

    // Update user access level
    await db.query(`
      UPDATE users
      SET subscription_tier = $1, access_level = $2, updated_at = NOW()
      WHERE email = $3
    `, [tier, status === 'trialing' ? 'trial' : 'active', customerEmail]);

    // Send welcome email for subscription using autoboot-style service
    await emailService.sendWelcomeEmail(customerEmail, customerName, tier);

    // Track conversion
    await trackConversion('subscription_created', customerEmail, {
      subscriptionId,
      tier,
      variantId: variant_id,
      status
    });

    // Emit event for real-time updates
    lemonSqueezyService.emit('subscription:created', {
      subscriptionId,
      customerEmail,
      tier,
      status
    });

  } catch (error) {
    logger.error('Error handling subscription_created:', error);
    throw error;
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(
  eventData: any,
  customerEmail: string,
  customerName: string,
  customData: any
): Promise<void> {
  try {
    const { id: subscriptionId, attributes } = eventData;
    const { ends_at } = attributes;

    logger.info(`❌ Subscription cancelled: ${subscriptionId}`, {
      customerEmail,
      endsAt: ends_at
    });

    // Update subscription status
    await db.query(`
      UPDATE user_subscriptions
      SET status = 'cancelled', cancelled_at = NOW(), cancel_at_period_end = $1, updated_at = NOW()
      WHERE subscription_id = $2
    `, [!!ends_at, subscriptionId]);

    // Update user access level (grace period)
    await db.query(`
      UPDATE users
      SET access_level = $1, updated_at = NOW()
      WHERE email = $2
    `, [ends_at ? 'grace_period' : 'cancelled', customerEmail]);

    // Get tier for email (need variant_id from attributes)
    const tier = determineTierFromVariant(attributes.variant_id);

    // Send cancellation email using autoboot-style service
    await emailService.sendSubscriptionCancelledEmail(
      customerEmail,
      customerName,
      tier,
      new Date(ends_at)
    );

    // Track cancellation
    await trackConversion('subscription_cancelled', customerEmail, {
      subscriptionId,
      cancelledAt: new Date().toISOString()
    });

    // Emit event
    lemonSqueezyService.emit('subscription:cancelled', {
      subscriptionId,
      customerEmail
    });

  } catch (error) {
    logger.error('Error handling subscription_cancelled:', error);
    throw error;
  }
}

/**
 * Handle subscription updates (plan changes, etc.)
 */
async function handleSubscriptionUpdated(
  eventData: any,
  customerEmail: string,
  customerName: string,
  customData: any
): Promise<void> {
  try {
    const { id: subscriptionId, attributes } = eventData;
    const { variant_id, status } = attributes;

    logger.info(`📈 Subscription updated: ${subscriptionId}`, {
      customerEmail,
      variantId: variant_id,
      status
    });

    // Determine new tier
    const tier = determineTierFromVariant(variant_id);
    const limits = getTierLimits(tier);

    // Update subscription
    await db.query(`
      UPDATE user_subscriptions
      SET subscription_tier = $1, variant_id = $2, status = $3, limits = $4, updated_at = NOW()
      WHERE subscription_id = $5
    `, [tier, variant_id, status, JSON.stringify(limits), subscriptionId]);

    // Update user access
    await db.query(`
      UPDATE users
      SET subscription_tier = $1, updated_at = NOW()
      WHERE email = $2
    `, [tier, customerEmail]);

    // Send payment confirmation for plan update using autoboot-style service
    await emailService.sendPaymentConfirmationEmail(
      customerEmail,
      customerName,
      tier,
      subscriptionId,
      0, // Amount might be 0 for plan updates
      'USD'
    );

    // Track update
    await trackConversion('subscription_updated', customerEmail, {
      subscriptionId,
      newTier: tier
    });

    // Emit event
    lemonSqueezyService.emit('subscription:updated', {
      subscriptionId,
      customerEmail,
      newTier: tier
    });

  } catch (error) {
    logger.error('Error handling subscription_updated:', error);
    throw error;
  }
}

/**
 * Handle payment success
 */
async function handlePaymentSuccess(
  eventData: any,
  customerEmail: string,
  customerName: string,
  customData: any
): Promise<void> {
  try {
    logger.info(`💳 Payment success: ${customerEmail}`);

    // Update subscription payment status
    await db.query(`
      UPDATE user_subscriptions
      SET payment_status = 'paid', last_payment_at = NOW(), updated_at = NOW()
      WHERE user_email = $1
    `, [customerEmail]);

    // Emit payment success event
    lemonSqueezyService.emit('payment:success', {
      customerEmail
    });

  } catch (error) {
    logger.error('Error handling payment_success:', error);
  }
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(
  eventData: any,
  customerEmail: string,
  customerName: string,
  customData: any
): Promise<void> {
  try {
    const { attributes } = eventData;
    const { retry_after } = attributes;

    logger.info(`💸 Payment failed: ${customerEmail}`, {
      retryAfter: retry_after
    });

    // Update subscription payment status
    await db.query(`
      UPDATE user_subscriptions
      SET payment_status = 'failed', last_payment_failed_at = NOW(), updated_at = NOW()
      WHERE user_email = $1
    `, [customerEmail]);

    // Get tier for email
    const tier = 'free'; // Fallback since variant not available in payment failed event

    // Send payment failed email using autoboot-style service
    const retryDate = retry_after ? new Date(retry_after) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // Default 3 days
    await emailService.sendPaymentFailedEmail(
      customerEmail,
      customerName,
      tier,
      0, // Amount might not be available in webhook
      retryDate
    );

    // Emit payment failed event
    lemonSqueezyService.emit('payment:failed', {
      customerEmail,
      retryDate
    });

  } catch (error) {
    logger.error('Error handling payment_failed:', error);
  }
}

/**
 * Helper function to determine tier from variant ID
 */
function determineTierFromVariant(variantId: string): string {
  // Map variant IDs to subscription tiers using qs- prefix
  if (variantId?.includes('qs-qestro-professional')) return 'professional';
  if (variantId?.includes('qs-qestro-enterprise')) return 'enterprise';
  if (variantId?.includes('qs-qestro-early-access')) return 'early_access';
  if (variantId?.includes('qs-qestro-free')) return 'free';

  // Fallback without prefix
  if (variantId?.includes('professional')) return 'professional';
  if (variantId?.includes('enterprise')) return 'enterprise';
  if (variantId?.includes('early-access')) return 'early_access';

  return 'free';
}

/**
 * Get limits for a specific tier
 */
function getTierLimits(tier: string) {
  const limits = {
    free: { tests: 100, projects: 1, teamMembers: 1, apiCalls: 1000 },
    professional: { tests: -1, projects: 10, teamMembers: 5, apiCalls: 10000 },
    enterprise: { tests: -1, projects: -1, teamMembers: -1, apiCalls: 100000 },
    early_access: { tests: -1, projects: 10, teamMembers: 5, apiCalls: 10000 }
  };

  return limits[tier] || limits.free;
}

/**
 * Track conversion events
 */
async function trackConversion(event: string, email: string, data?: any): Promise<void> {
  try {
    await db.query(`
      INSERT INTO conversion_events (event_type, email, data, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [event, email, JSON.stringify(data)]);
  } catch (error) {
    logger.error('Failed to track conversion:', error);
  }
}

// Placeholder functions for other events
async function handleOrderRefunded(eventData: any, customerEmail: string, customerName: string, customData: any): Promise<void> {
  logger.info(`💸 Order refunded: ${customerEmail}`);
  // Implementation similar to other handlers
}

async function handleSubscriptionResumed(eventData: any, customerEmail: string, customerName: string, customData: any): Promise<void> {
  logger.info(`▶️ Subscription resumed: ${customerEmail}`);
  // Implementation similar to other handlers
}

async function handleSubscriptionExpired(eventData: any, customerEmail: string, customerName: string, customData: any): Promise<void> {
  logger.info(`⏰ Subscription expired: ${customerEmail}`);
  // Implementation similar to other handlers
}

async function handleSubscriptionPaused(eventData: any, customerEmail: string, customerName: string, customData: any): Promise<void> {
  logger.info(`⏸️ Subscription paused: ${customerEmail}`);
  // Implementation similar to other handlers
}

async function handleSubscriptionUnpaused(eventData: any, customerEmail: string, customerName: string, customData: any): Promise<void> {
  logger.info(`▶️ Subscription unpaused: ${customerEmail}`);
  // Implementation similar to other handlers
}

async function handlePaymentRefunded(eventData: any, customerEmail: string, customerName: string, customData: any): Promise<void> {
  logger.info(`💸 Payment refunded: ${customerEmail}`);
  // Implementation similar to other handlers
}

async function handlePaymentRecovered(eventData: any, customerEmail: string, customerName: string, customData: any): Promise<void> {
  logger.info(`💳 Payment recovered: ${customerEmail}`);
  // Implementation similar to other handlers
}

export default router;