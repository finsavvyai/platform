/**
 * Subscription Management — utility functions
 */

import type { Subscription, SubscriptionStatus, SubscriptionFeatures } from './subscriptionTypes';
import { DEFAULT_PLANS } from './subscriptionPlans';

export function getLimitForMetric(features: SubscriptionFeatures, metric: string): number {
  switch (metric) {
    case 'teams': return features.maxTeams;
    case 'members_per_team': return features.maxMembersPerTeam;
    case 'connections': return features.maxConnections;
    case 'queries_per_month': return features.maxQueriesPerMonth;
    case 'storage_gb': return features.maxStorageGB;
    default: return -1;
  }
}

export function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price / 100);
}

export function getPlanComparison() {
  return { free: DEFAULT_PLANS[0], pro: DEFAULT_PLANS[1], business: DEFAULT_PLANS[2], enterprise: DEFAULT_PLANS[3] };
}

export function isActiveSubscription(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'active' || subscription.status === 'trialing';
}

export function getStatusColor(status: SubscriptionStatus): string {
  const colors: Record<SubscriptionStatus, string> = {
    active: 'green', trialing: 'blue', past_due: 'yellow',
    cancelled: 'gray', unpaid: 'red', paused: 'orange',
  };
  return colors[status] || 'gray';
}

export function getStatusText(status: SubscriptionStatus): string {
  const texts: Record<SubscriptionStatus, string> = {
    active: 'Active', trialing: 'Trial', past_due: 'Past Due',
    cancelled: 'Cancelled', unpaid: 'Unpaid', paused: 'Paused',
  };
  return texts[status] || status;
}

export function calculateSavings(monthlyPrice: number, yearlyPrice: number): number {
  return Math.round(((monthlyPrice - yearlyPrice / 12) / monthlyPrice) * 100);
}

export function getTrialDaysRemaining(subscription: Subscription | null): number {
  if (!subscription?.trialEndsAt) return 0;
  const diff = new Date(subscription.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
