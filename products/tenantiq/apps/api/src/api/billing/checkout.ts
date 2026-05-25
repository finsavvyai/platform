import { nanoid } from 'nanoid';
import type { CheckoutSession, CheckoutRequest, Coupon } from './types';
import { getPlanPrice, getPlan } from './plans';

const sessions = new Map<string, CheckoutSession>();
const coupons = new Map<string, Coupon>();

export async function createCheckoutSession(
  orgId: string,
  request: CheckoutRequest
): Promise<CheckoutSession> {
  const plan = getPlan(request.planId);
  if (!plan) {
    throw new Error('Invalid plan ID');
  }

  let amount = getPlanPrice(request.planId, request.billingCycle);
  if (!amount) {
    throw new Error('Cannot determine price for plan');
  }

  if (request.coupon) {
    const coupon = coupons.get(request.coupon);
    if (coupon && isValidCoupon(coupon)) {
      const discount = applyCoupon(amount, coupon);
      amount -= discount;
    }
  }

  const sessionId = nanoid();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const session: CheckoutSession = {
    id: nanoid(),
    sessionId,
    orgId,
    planId: request.planId,
    billingCycle: request.billingCycle,
    amount,
    currency: plan.pricing.currency,
    redirectUrl: `https://payment.tenantiq.io/checkout/${sessionId}`,
    expiresAt,
    status: 'pending',
    createdAt: new Date()
  };

  sessions.set(session.id, session);
  return session;
}

export function getCheckoutSession(sessionId: string): CheckoutSession | null {
  return sessions.get(sessionId) || null;
}

function isValidCoupon(coupon: Coupon): boolean {
  const now = new Date();
  return (
    coupon.usedCount < (coupon.maxUses || Infinity) &&
    coupon.validFrom <= now &&
    coupon.validTo >= now
  );
}

function applyCoupon(amount: number, coupon: Coupon): number {
  if (coupon.type === 'percentage') {
    return (amount * coupon.value) / 100;
  }
  return Math.min(amount, coupon.value);
}

export async function validateCoupon(code: string, amount: number): Promise<{
  valid: boolean;
  discount?: number;
  finalAmount?: number;
  error?: string;
}> {
  const coupon = coupons.get(code);

  if (!coupon) {
    return { valid: false, error: 'Coupon not found' };
  }

  if (!isValidCoupon(coupon)) {
    return { valid: false, error: 'Coupon is no longer valid' };
  }

  if (coupon.minAmount && amount < coupon.minAmount) {
    return { valid: false, error: `Minimum amount ${coupon.minAmount} required` };
  }

  const discount = applyCoupon(amount, coupon);
  return {
    valid: true,
    discount,
    finalAmount: amount - discount
  };
}

export function addCoupon(code: string, coupon: Coupon): void {
  coupons.set(code, coupon);
}

export function useCoupon(code: string): boolean {
  const coupon = coupons.get(code);
  if (coupon) {
    coupon.usedCount++;
    return true;
  }
  return false;
}

export async function cancelCheckoutSession(sessionId: string): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = 'cancelled';
    return true;
  }
  return false;
}

export async function completeCheckoutSession(
  sessionId: string,
  status: 'success' | 'failure'
): Promise<CheckoutSession | null> {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = status;
    return session;
  }
  return null;
}

export function cleanupExpiredSessions(): number {
  let removed = 0;
  const now = new Date();

  for (const [key, session] of sessions.entries()) {
    if (session.expiresAt < now && session.status === 'pending') {
      sessions.delete(key);
      removed++;
    }
  }

  return removed;
}
