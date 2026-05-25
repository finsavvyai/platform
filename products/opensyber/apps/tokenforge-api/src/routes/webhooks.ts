import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { tfTenants } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { verifyWebhookSignature } from '../lib/webhook-signature.js';
import { webhookPayloadSchema } from '../lib/webhook-schemas.js';
import { buildVariantMap } from '../lib/variant-map.js';
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionCancelled,
  handleSubscriptionExpired,
  handlePaymentSuccess,
  handlePaymentFailed,
} from './webhook-handlers.js';

export const webhookRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

webhookRoutes.post('/lemonsqueezy', async (c) => {
  const signature = c.req.header('X-Signature');
  if (!signature) {
    return c.json({ error: 'missing_signature', message: 'Missing X-Signature header' }, 400);
  }

  const rawBody = await c.req.text();
  const isValid = await verifyWebhookSignature(
    rawBody,
    signature,
    c.env.LEMONSQUEEZY_WEBHOOK_SECRET,
  );

  if (!isValid) {
    console.error('[TF Webhook] Signature mismatch');
    return c.json({ error: 'invalid_signature', message: 'Invalid webhook signature' }, 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'invalid_json', message: 'Invalid JSON body' }, 400);
  }

  const result = webhookPayloadSchema.safeParse(parsed);
  if (!result.success) {
    return c.json(
      { error: 'validation_error', message: 'Invalid webhook payload' },
      400,
    );
  }

  const payload = result.data;
  const productId = parseInt(c.env.TF_LS_PRODUCT_ID, 10);

  if (payload.data.attributes.product_id !== productId) {
    return c.json({ received: true, ignored: true });
  }

  const db = c.get('db');
  const eventName = payload.meta.event_name;
  const variantMap = buildVariantMap(c.env);

  switch (eventName) {
    case 'subscription_created':
      await handleSubscriptionCreated(db, payload, variantMap);
      break;
    case 'subscription_updated':
      await handleSubscriptionUpdated(db, payload, variantMap);
      break;
    case 'subscription_cancelled':
      await handleSubscriptionCancelled(db, payload);
      break;
    case 'subscription_expired':
      await handleSubscriptionExpired(db, payload);
      break;
    case 'subscription_payment_success':
      await handlePaymentSuccess(payload);
      break;
    case 'subscription_payment_failed':
      await handlePaymentFailed(db, payload, c.env.RESEND_API_KEY);
      break;
    default:
      console.log(`[TF Webhook] Unhandled event: ${eventName}`);
  }

  return c.json({ received: true });
});
