import { apiFetch } from './client';
import type { ApiResponse, BillingPlan } from '../../types';

export async function getBillingPlans(): Promise<ApiResponse<BillingPlan[]>> {
  return apiFetch('/api/billing/plans');
}

export async function getSubscription(): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/billing/subscription');
}

export async function getUsage(): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/billing/usage');
}

export async function getInvoices(): Promise<ApiResponse<unknown[]>> {
  return apiFetch('/api/billing/invoices');
}

export async function createCheckout(data: {
  planId: string;
}): Promise<ApiResponse<{ url: string }>> {
  return apiFetch('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function changeSubscription(data: {
  planId: string;
}): Promise<ApiResponse<void>> {
  return apiFetch('/api/billing/subscription/change', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function cancelSubscription(): Promise<ApiResponse<void>> {
  return apiFetch('/api/billing/subscription/cancel', { method: 'POST' });
}

export async function getBillingPortal(): Promise<ApiResponse<{ url: string }>> {
  return apiFetch('/api/billing/portal', { method: 'POST' });
}
