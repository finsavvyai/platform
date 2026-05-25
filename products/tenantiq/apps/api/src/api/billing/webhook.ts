import { createHmac } from 'crypto';
import type { WebhookEvent, Subscription } from './types';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';
const subscriptions = new Map<string, Subscription>();

export interface WebhookPayload {
  event: string;
  data: Record<string, any>;
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string
): Promise<boolean> {
  const hash = createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return hash === signature;
}

export async function handleWebhookEvent(event: WebhookPayload, orgId?: string): Promise<{
  success: boolean;
  action?: string;
  error?: string;
}> {
  try {
    switch (event.event) {
      case 'checkout.session.completed':
        return await handleCheckoutCompleted(event.data);

      case 'payment.success':
        return await handlePaymentSuccess(event.data);

      case 'payment.failed':
        return await handlePaymentFailed(event.data);

      case 'refund.completed':
        return await handleRefund(event.data);

      case 'subscription.created':
        return await handleSubscriptionCreated(event.data);

      case 'subscription.updated':
        return await handleSubscriptionUpdated(event.data);

      case 'subscription.cancelled':
        return await handleSubscriptionCancelled(event.data);

      case 'invoice.created':
        return await handleInvoiceCreated(event.data);

      case 'invoice.paid':
        return await handleInvoicePaid(event.data);

      case 'invoice.payment_failed':
        return await handleInvoicePaymentFailed(event.data);

      default:
        return { success: false, error: `Unknown event type: ${event.event}` };
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function handleCheckoutCompleted(data: Record<string, any>): Promise<{
  success: boolean;
  action?: string;
}> {
  if (data.status === 'success') {
    return { success: true, action: 'payment_success' };
  }
  return { success: false };
}

async function handlePaymentSuccess(data: Record<string, any>): Promise<{
  success: boolean;
  action?: string;
}> {
  const subscription: Subscription = {
    id: data.subscriptionId || `sub_${Date.now()}`,
    orgId: data.orgId,
    planId: data.planId,
    status: 'active',
    billingCycle: data.billingCycle || 'monthly',
    currentPrice: data.amount,
    currency: data.currency || 'USD',
    startDate: new Date(),
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    autoRenew: true
  };

  subscriptions.set(data.subscriptionId, subscription);
  return { success: true, action: 'subscription_activated' };
}

async function handlePaymentFailed(data: Record<string, any>): Promise<{
  success: boolean;
  action?: string;
}> {
  console.log('Payment failed:', data);
  return { success: true, action: 'payment_failed_notified' };
}

async function handleRefund(data: Record<string, any>): Promise<{
  success: boolean;
  action?: string;
}> {
  return { success: true, action: 'refund_processed' };
}

async function handleSubscriptionCreated(data: Record<string, any>): Promise<{
  success: boolean;
  action?: string;
}> {
  const subscription: Subscription = {
    id: data.id,
    orgId: data.orgId,
    planId: data.planId,
    status: 'active',
    billingCycle: data.billingCycle || 'monthly',
    currentPrice: data.amount,
    currency: data.currency || 'USD',
    startDate: new Date(),
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    autoRenew: true
  };

  subscriptions.set(data.id, subscription);
  return { success: true, action: 'subscription_created' };
}

async function handleSubscriptionUpdated(data: Record<string, any>): Promise<{
  success: boolean;
  action?: string;
}> {
  const subscription = subscriptions.get(data.id);
  if (subscription) {
    subscription.planId = data.planId || subscription.planId;
    subscription.status = data.status || subscription.status;
  }
  return { success: true, action: 'subscription_updated' };
}

async function handleSubscriptionCancelled(data: Record<string, any>): Promise<{
  success: boolean;
  action?: string;
}> {
  const subscription = subscriptions.get(data.id);
  if (subscription) {
    subscription.status = 'cancelled';
    subscription.cancellationDate = new Date();
  }
  return { success: true, action: 'subscription_cancelled' };
}

async function handleInvoiceCreated(data: Record<string, any>): Promise<{
  success: boolean;
  action?: string;
}> {
  return { success: true, action: 'invoice_created' };
}

async function handleInvoicePaid(data: Record<string, any>): Promise<{
  success: boolean;
  action?: string;
}> {
  return { success: true, action: 'invoice_paid' };
}

async function handleInvoicePaymentFailed(data: Record<string, any>): Promise<{
  success: boolean;
  action?: string;
}> {
  return { success: true, action: 'invoice_payment_failed' };
}

export function getSubscription(subscriptionId: string): Subscription | null {
  return subscriptions.get(subscriptionId) || null;
}

export function getOrgSubscription(orgId: string): Subscription | null {
  for (const sub of subscriptions.values()) {
    if (sub.orgId === orgId) {
      return sub;
    }
  }
  return null;
}

export function saveSubscription(subscription: Subscription): void {
  subscriptions.set(subscription.id, subscription);
}
