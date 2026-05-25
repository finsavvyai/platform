/**
 * LemonSqueezy webhook verification and handling
 */

import { createHmac } from 'crypto';

export async function verifyWebhookSignature(
  signature: string,
  body: string
): Promise<boolean> {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('LEMONSQUEEZY_WEBHOOK_SECRET not set, skipping verification');
    return true;
  }

  try {
    const hash = createHmac('sha256', secret).update(body).digest('hex');
    return signature === `sha256=${hash}`;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

export function parseWebhookEvent(body: string): Record<string, unknown> {
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Invalid webhook payload');
  }
}

export function extractCustomData(event: Record<string, unknown>): Record<string, unknown> {
  const meta = event.meta as Record<string, unknown>;
  return (meta?.custom_data as Record<string, unknown>) || {};
}
