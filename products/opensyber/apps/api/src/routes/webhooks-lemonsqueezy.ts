import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { timingSafeCompare } from '../lib/timing-safe.js';
import {
  type LsSubscription,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionEnded,
  handlePaymentFailed,
  buildVariantMap,
} from './handlers/lemonsqueezy-handlers.js';

const lemonSqueezyWebhookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Hex-encode a buffer. */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

lemonSqueezyWebhookRoutes.post('/lemonsqueezy', async (c) => {
  const db = c.get('db');

  const signature = c.req.header('X-Signature');
  if (!signature) return c.json({ error: 'Missing signature' }, 401);

  const rawBody = await c.req.text();

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(c.env.LEMONSQUEEZY_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  if (!timingSafeCompare(signature, expectedSignature)) {
    console.error('LemonSqueezy webhook signature mismatch');
    return c.json({ error: 'Invalid signature' }, 401);
  }

  // Idempotency: hash the verified raw body. 7-day TTL covers LS retry window.
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(rawBody));
  const seenKey = `ls-webhook-seen:${toHex(digest)}`;
  if (await c.env.CACHE.get(seenKey)) {
    return c.json({ received: true, duplicate: true });
  }
  await c.env.CACHE.put(seenKey, '1', { expirationTtl: 7 * 86400 });

  let body: {
    meta: { event_name: string; store_id?: number | string; custom_data?: { user_id?: string } };
    data: LsSubscription;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    await c.env.CACHE.delete(seenKey).catch(() => {});
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  // Validate meta.store_id matches the configured store. Rejects cross-store spoofing.
  const configuredStoreId = parseInt(c.env.LEMONSQUEEZY_STORE_ID, 10);
  if (Number.isFinite(configuredStoreId)) {
    const metaStoreId = body.meta?.store_id;
    const metaStoreIdNum = typeof metaStoreId === 'string' ? parseInt(metaStoreId, 10) : metaStoreId;
    if (metaStoreIdNum !== undefined && metaStoreIdNum !== configuredStoreId) {
      console.warn(
        `[LemonSqueezy] Rejecting webhook for foreign meta.store_id ${metaStoreIdNum} ` +
        `(expected ${configuredStoreId})`,
      );
      await c.env.CACHE.delete(seenKey).catch(() => {});
      return c.json({ error: 'Unauthorized', message: 'Event does not belong to this store' }, 401);
    }
  }

  const eventName = body.meta.event_name;
  const userId = body.meta.custom_data?.user_id;
  const subscription = body.data;

  if (Number.isFinite(configuredStoreId) && subscription.attributes.store_id !== configuredStoreId) {
    console.warn(
      `[LemonSqueezy] Rejecting webhook for foreign store_id ${subscription.attributes.store_id} ` +
      `(expected ${configuredStoreId})`,
    );
    await c.env.CACHE.delete(seenKey).catch(() => {});
    return c.json({ error: 'Forbidden', message: 'Event does not belong to this store' }, 403);
  }

  const opensyberProductId = parseInt(c.env.OPENSYBER_LS_PRODUCT_ID, 10);
  if (subscription.attributes.product_id !== opensyberProductId) {
    console.log(`[LemonSqueezy] Ignoring event for product ${subscription.attributes.product_id}`);
    return c.json({ received: true, ignored: true });
  }

  console.log(`[LemonSqueezy Webhook] Event: ${eventName}, User: ${userId}`);
  const variantMap = buildVariantMap(c.env);

  try {
    switch (eventName) {
      case 'subscription_created':
        await handleSubscriptionCreated(db, userId, subscription, variantMap);
        break;
      case 'subscription_updated':
        await handleSubscriptionUpdated(db, subscription, variantMap);
        break;
      case 'subscription_cancelled':
      case 'subscription_expired':
        await handleSubscriptionEnded(db, subscription);
        break;
      case 'subscription_payment_success':
        console.log(`[LemonSqueezy] Payment success for subscription ${subscription.id}`);
        break;
      case 'subscription_payment_failed':
        await handlePaymentFailed(db, subscription, c.env);
        break;
      default:
        console.log(`[LemonSqueezy] Unhandled event: ${eventName}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[LemonSqueezy] Handler error (${eventName}):`, msg);
    // Delete idempotency key so a manual retry can reprocess, but still return 200
    // to prevent LemonSqueezy from entering infinite retry loops.
    await c.env.CACHE.delete(seenKey).catch(() => {});
  }

  return c.json({ received: true });
});

export { lemonSqueezyWebhookRoutes };
