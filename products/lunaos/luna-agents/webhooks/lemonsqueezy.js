/**
 * LemonSqueezy Webhook Handler
 * Handles subscription events and manages API keys
 */

const crypto = require('crypto');

// LemonSqueezy webhook events
const EVENTS = {
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_UPDATED: 'subscription_updated',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_RESUMED: 'subscription_resumed',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
  SUBSCRIPTION_PAYMENT_SUCCESS: 'subscription_payment_success',
  SUBSCRIPTION_PAYMENT_FAILED: 'subscription_payment_failed',
};

/**
 * Verify webhook signature
 */
function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  if (digest.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

/**
 * Main webhook handler
 */
async function handleWebhook(req, res) {
  try {
    const signature = req.headers['x-signature'];
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    
    // Verify signature
    if (!verifyWebhook(JSON.stringify(req.body), signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const event = req.body;
    const eventName = event.meta.event_name;
    const data = event.data.attributes;
    
    console.log(`Received webhook: ${eventName}`, {
      customerId: data.customer_id,
      subscriptionId: data.id,
    });
    
    // Handle different events
    switch (eventName) {
      case EVENTS.SUBSCRIPTION_CREATED:
        await handleSubscriptionCreated(data);
        break;
        
      case EVENTS.SUBSCRIPTION_UPDATED:
        await handleSubscriptionUpdated(data);
        break;
        
      case EVENTS.SUBSCRIPTION_CANCELLED:
        await handleSubscriptionCancelled(data);
        break;
        
      case EVENTS.SUBSCRIPTION_RESUMED:
        await handleSubscriptionResumed(data);
        break;
        
      case EVENTS.SUBSCRIPTION_EXPIRED:
        await handleSubscriptionExpired(data);
        break;
        
      case EVENTS.SUBSCRIPTION_PAYMENT_SUCCESS:
        await handlePaymentSuccess(data);
        break;
        
      case EVENTS.SUBSCRIPTION_PAYMENT_FAILED:
        await handlePaymentFailed(data);
        break;
        
      default:
        console.log(`Unhandled event: ${eventName}`);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ received: false, error: 'Processing failed' });
  }
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(data) {
  const customerId = data.customer_id;
  const email = data.user_email;
  const subscriptionId = data.id;
  const productId = data.product_id;
  
  // Determine tier based on product
  const tier = getTierFromProduct(productId);
  
  // Generate API key via auth service
  const response = await fetch(`${process.env.AUTH_SERVICE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}`,
    },
    body: JSON.stringify({
      customerId,
      email,
      tier,
      subscriptionId,
    }),
  });
  
  const { apiKey } = await response.json();
  
  // Send welcome email with API key
  await sendWelcomeEmail(email, apiKey, tier);
  
  console.log(`API key generated for customer ${customerId}: ${apiKey}`);
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(data) {
  const customerId = data.customer_id;
  const status = data.status;
  
  // Update subscription status in database
  console.log(`Subscription updated for customer ${customerId}: ${status}`);
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(data) {
  const customerId = data.customer_id;
  const endsAt = data.ends_at;
  
  // Mark API key as expiring
  await updateAPIKeyStatus(customerId, 'cancelled', new Date(endsAt).getTime());
  
  // Send cancellation email
  await sendCancellationEmail(data.user_email, endsAt);
  
  console.log(`Subscription cancelled for customer ${customerId}, ends at ${endsAt}`);
}

/**
 * Handle subscription resumed
 */
async function handleSubscriptionResumed(data) {
  const customerId = data.customer_id;
  
  // Reactivate API key
  await updateAPIKeyStatus(customerId, 'active', null);
  
  console.log(`Subscription resumed for customer ${customerId}`);
}

/**
 * Handle subscription expired
 */
async function handleSubscriptionExpired(data) {
  const customerId = data.customer_id;
  
  // Deactivate API key
  await updateAPIKeyStatus(customerId, 'expired', Date.now());
  
  console.log(`Subscription expired for customer ${customerId}`);
}

/**
 * Handle payment success
 */
async function handlePaymentSuccess(data) {
  const customerId = data.customer_id;
  
  // Ensure API key is active
  await updateAPIKeyStatus(customerId, 'active', null);
  
  console.log(`Payment successful for customer ${customerId}`);
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(data) {
  const customerId = data.customer_id;
  const email = data.user_email;
  
  // Send payment failed notification
  await sendPaymentFailedEmail(email);
  
  console.log(`Payment failed for customer ${customerId}`);
}

/**
 * Get tier from product ID
 */
function getTierFromProduct(productId) {
  // Map your LemonSqueezy product IDs to tiers
  const productTiers = {
    'YOUR_PRO_MONTHLY_PRODUCT_ID': 'pro',
    'YOUR_PRO_ANNUAL_PRODUCT_ID': 'pro',
    // Add more products as needed
  };
  
  return productTiers[productId] || 'free';
}

/**
 * Update API key status
 */
async function updateAPIKeyStatus(customerId, status, expiresAt) {
  // Call your API auth service to update status
  // This would update the KV store
  console.log(`Updating API key for ${customerId}: ${status}`);
}

/**
 * Send welcome email with API key
 */
async function sendWelcomeEmail(email, apiKey, tier) {
  // Integrate with your email service (SendGrid, Resend, etc.)
  console.log(`Sending welcome email to ${email} with API key`);
  
  const emailContent = `
    Welcome to Luna Agents ${tier.toUpperCase()}!
    
    Your API key: ${apiKey}
    
    Get started:
    1. Install Luna Agents: https://github.com/shacharsol/luna-agent
    2. Add your API key to configuration
    3. Start using Luna Vision RAG™!
    
    Documentation: https://agent.lunaos.ai/docs
    Dashboard: https://agent.lunaos.ai/dashboard
    
    Questions? Reply to this email or visit https://agent.lunaos.ai/support
  `;
  
  // Send email via your email service
}

/**
 * Send cancellation email
 */
async function sendCancellationEmail(email, endsAt) {
  console.log(`Sending cancellation email to ${email}`);
}

/**
 * Send payment failed email
 */
async function sendPaymentFailedEmail(email) {
  console.log(`Sending payment failed email to ${email}`);
}

module.exports = {
  handleWebhook,
  verifyWebhook,
};
