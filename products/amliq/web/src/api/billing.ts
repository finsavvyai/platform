import { api } from './client';
import type { Product, Subscription, UsageRecord, Seat, Invoice } from '../types/billing';

export async function getProducts(): Promise<Product[]> {
  return api.get<Product[]>('/billing/products');
}

export async function getSubscriptions(): Promise<Subscription[]> {
  return api.get<Subscription[]>('/billing/subscriptions');
}

export async function createCheckout(
  product: string,
  planId: string,
  promoCode?: string,
  billingPeriod: 'monthly' | 'annual' = 'monthly',
): Promise<{ checkoutUrl: string }> {
  return api.post('/billing/checkout', { product, planId, promoCode, billingPeriod });
}

export async function getSeats(): Promise<Seat[]> {
  return api.get<Seat[]>('/billing/seats');
}

export async function addSeat(email: string, role: string): Promise<Seat> {
  return api.post<Seat>('/billing/seats', { email, role });
}

export async function removeSeat(userId: string): Promise<void> {
  return api.del(`/billing/seats/${userId}`);
}

export async function getUsage(product: string): Promise<UsageRecord | null> {
  return api.get<UsageRecord | null>(`/billing/usage?product=${product}`);
}

export async function applyPromoCode(code: string): Promise<{ discountPercent: number; message: string }> {
  return api.post('/billing/promo', { code });
}

export async function getInvoices(): Promise<Invoice[]> {
  return api.get<Invoice[]>('/billing/invoices');
}

export interface BillingHealth {
  status: string;
  mode: string;
  ls_configured: boolean;
  webhook_enabled: boolean;
}

export async function getBillingHealth(): Promise<BillingHealth> {
  return api.get<BillingHealth>('/billing/health');
}
