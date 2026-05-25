// Billing API methods
import type { ApiFetchFn } from './types';

export function createBillingApi(fetchFn: ApiFetchFn) {
  return {
    async getPlans() {
      return fetchFn('/api/billing/plans');
    },

    async getSubscription() {
      return fetchFn('/api/billing/subscription');
    },

    async getUsage() {
      return fetchFn('/api/billing/usage');
    },

    async getInvoices() {
      return fetchFn('/api/billing/invoices');
    },

    async createCheckoutSession(
      planId: string,
      interval: 'month' | 'year' = 'month'
    ) {
      return fetchFn('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId, interval }),
      });
    },

    async changeSubscription(
      newPlanId: string,
      interval: 'month' | 'year' = 'month'
    ) {
      return fetchFn('/api/billing/subscription/change', {
        method: 'POST',
        body: JSON.stringify({ newPlanId, interval }),
      });
    },

    async cancelSubscription() {
      return fetchFn('/api/billing/subscription/cancel', {
        method: 'POST',
      });
    },

    async reactivateSubscription() {
      return fetchFn('/api/billing/subscription/reactivate', {
        method: 'POST',
      });
    },

    async createBillingPortalSession() {
      return fetchFn('/api/billing/portal', {
        method: 'POST',
      });
    },

    async getFeatureAccess(feature: string) {
      return fetchFn(`/api/billing/feature-access/${encodeURIComponent(feature)}`);
    },
  };
}
