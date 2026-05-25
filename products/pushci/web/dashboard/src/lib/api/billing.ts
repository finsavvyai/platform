import { apiFetch } from '../api-client';

export interface CheckoutInput {
  plan: string;
  discount_code?: string;
}

export interface CheckoutResponse {
  url: string;
}

export interface BillingPortalResponse {
  url: string;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ck-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const billingApi = {
  checkout: (input: CheckoutInput, idempotencyKey: string = newIdempotencyKey()) =>
    apiFetch<CheckoutResponse>('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    }),
  portal: () => apiFetch<BillingPortalResponse>('/api/billing/portal'),
  newIdempotencyKey,
};
