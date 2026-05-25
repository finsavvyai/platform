/**
 * Payment webhook handler for subscription events.
 * Processes LemonSqueezy webhook events and updates subscription state.
 */

import type { DB } from '../db/client.js';
import { updateSubscription, getSubscription } from '../db/queries.js';
import type { WebhookEvent, SubscriptionEvent } from './types.js';

export class WebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookError';
  }
}

export async function handleSubscriptionEvent(
  db: DB,
  event: WebhookEvent,
): Promise<SubscriptionEvent | null> {
  const eventType = event.type;

  if (eventType === 'subscription_created') {
    return handleSubscriptionCreated(db, event);
  }

  if (eventType === 'subscription_updated') {
    return handleSubscriptionUpdated(db, event);
  }

  if (eventType === 'subscription_expired') {
    return handleSubscriptionExpired(db, event);
  }

  if (eventType === 'subscription_cancelled') {
    return handleSubscriptionCancelled(db, event);
  }

  return null;
}

async function handleSubscriptionCreated(db: DB, event: WebhookEvent): Promise<SubscriptionEvent> {
  const userId = extractUserId(event.data);
  const plan = extractPlan(event.data);
  const expiresAt = extractExpiresAt(event.data);

  if (!userId || !plan || !expiresAt) {
    throw new WebhookError('Missing required fields in subscription_created event');
  }

  await updateSubscription(db, userId, {
    status: 'active',
    expires_at: expiresAt,
  });

  return {
    id: event.id,
    userId,
    plan: plan as 'free' | 'pro' | 'enterprise',
    status: 'active',
    expiresAt,
  };
}

async function handleSubscriptionUpdated(db: DB, event: WebhookEvent): Promise<SubscriptionEvent> {
  const userId = extractUserId(event.data);
  const plan = extractPlan(event.data);
  const expiresAt = extractExpiresAt(event.data);

  if (!userId) throw new WebhookError('Missing userId in subscription_updated event');

  const updates: Record<string, unknown> = {};
  if (expiresAt) updates.expires_at = expiresAt;

  await updateSubscription(db, userId, updates as Parameters<typeof updateSubscription>[2]);

  const subscription = await getSubscription(db, userId);
  if (!subscription) throw new WebhookError('Subscription not found after update');

  return {
    id: event.id,
    userId,
    plan: subscription.plan,
    status: subscription.status as 'active' | 'expired' | 'cancelled',
    expiresAt: subscription.expires_at,
  };
}

async function handleSubscriptionExpired(db: DB, event: WebhookEvent): Promise<SubscriptionEvent> {
  const userId = extractUserId(event.data);
  if (!userId) throw new WebhookError('Missing userId in subscription_expired event');

  await updateSubscription(db, userId, { status: 'expired' });

  const subscription = await getSubscription(db, userId);
  if (!subscription) throw new WebhookError('Subscription not found after expiry');

  return {
    id: event.id,
    userId,
    plan: subscription.plan,
    status: 'expired',
    expiresAt: subscription.expires_at,
  };
}

async function handleSubscriptionCancelled(db: DB, event: WebhookEvent): Promise<SubscriptionEvent> {
  const userId = extractUserId(event.data);
  if (!userId) throw new WebhookError('Missing userId in subscription_cancelled event');

  await updateSubscription(db, userId, { status: 'cancelled' });

  const subscription = await getSubscription(db, userId);
  if (!subscription) throw new WebhookError('Subscription not found after cancellation');

  return {
    id: event.id,
    userId,
    plan: subscription.plan,
    status: 'cancelled',
    expiresAt: subscription.expires_at,
  };
}

function extractUserId(data: Record<string, unknown>): string | undefined {
  return ((data.checkout_data as Record<string, unknown>)?.custom as Record<string, unknown> | undefined)?.userId as string | undefined;
}

function extractPlan(data: Record<string, unknown>): string | undefined {
  return (data.attributes as Record<string, unknown>)?.plan as string | undefined;
}

function extractExpiresAt(data: Record<string, unknown>): Date | undefined {
  const expiresAtStr = (data.attributes as Record<string, unknown>)?.expires_at;
  return expiresAtStr ? new Date(expiresAtStr as string) : undefined;
}
