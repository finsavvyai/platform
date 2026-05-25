/**
 * Types and configuration for subscription management
 */

import type {
	CreditCard,
} from 'lucide-svelte';

export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'cancelled';
export type SubscriptionTier = 'core' | 'professional' | 'security_suite' | 'enterprise';

export interface Subscription {
	id: string;
	organizationId: string;
	organizationName: string;
	tier: SubscriptionTier;
	status: SubscriptionStatus;
	monthlyPrice: number;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	trialEndsAt?: Date;
	maxUsers: number;
	currentUsers: number;
	maxScansPerMonth: number;
	currentScans: number;
	autoRenew: boolean;
}

export interface SubscriptionStats {
	activeSubscriptions: number;
	trialAccounts: number;
	pastDue: number;
	totalMRR: number;
	avgRevenuePerAccount: number;
	churnRate: number;
}

export interface TierConfig {
	name: string;
	price: number;
	color: string;
	bgColor: string;
}

export interface StatusConfig {
	label: string;
	color: string;
	icon: typeof CreditCard;
}

export function formatCurrency(amount: number) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 0
	}).format(amount);
}

export function formatDate(date: Date) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(date);
}

export function getDaysUntilExpiry(date: Date) {
	const now = new Date();
	const diff = date.getTime() - now.getTime();
	return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getUsagePercentage(current: number, max: number) {
	return Math.round((current / max) * 100);
}
