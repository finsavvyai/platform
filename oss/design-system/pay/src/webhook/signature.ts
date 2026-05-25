import { createHmac } from 'crypto';
import { WebhookSignatureError } from '../types.js';

export function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const [timestamp, signedContent] = signature.split(',').map((part) => part.split('=')[1]);

  if (!timestamp || !signedContent) {
    throw new WebhookSignatureError('Invalid Stripe signature format');
  }

  const signed = `${timestamp}.${payload}`;
  const hash = createHmac('sha256', secret).update(signed).digest('hex');

  return hash === signedContent;
}

export function verifyLemonSqueezySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const hash = createHmac('sha256', secret).update(payload).digest('hex');

  return hash === signature;
}

export function getSignatureTimestamp(signature: string): number {
  const timestampPart = signature.split(',').find((part) => part.startsWith('t='));
  if (!timestampPart) {
    throw new WebhookSignatureError('Timestamp not found in signature');
  }

  return parseInt(timestampPart.split('=')[1], 10);
}

export const STRIPE_SIGNATURE_MAX_AGE_SECONDS = 300;

export function validateTimestamp(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) < STRIPE_SIGNATURE_MAX_AGE_SECONDS;
}
