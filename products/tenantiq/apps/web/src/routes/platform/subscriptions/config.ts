/**
 * Subscription tier and status display configuration
 */

import {
	CreditCard,
	Clock,
	AlertCircle
} from 'lucide-svelte';
import type { SubscriptionTier, SubscriptionStatus, TierConfig, StatusConfig } from './types';

export const tierInfo: Record<SubscriptionTier, TierConfig> = {
	core: {
		name: 'Core',
		price: 79,
		color: 'text-[var(--color-primary)]',
		bgColor: 'bg-[var(--color-primary)]'
	},
	professional: {
		name: 'Professional',
		price: 199,
		color: 'text-purple-500',
		bgColor: 'bg-purple-600'
	},
	security_suite: {
		name: 'Security Suite',
		price: 399,
		color: 'text-[var(--color-orange)]',
		bgColor: 'bg-[var(--color-orange)]'
	},
	enterprise: {
		name: 'Enterprise',
		price: 0,
		color: 'text-[var(--color-green)]',
		bgColor: 'bg-[var(--color-green)]'
	}
};

export const statusInfo: Record<SubscriptionStatus, StatusConfig> = {
	active: { label: 'Active', color: 'bg-[var(--color-success)] text-white', icon: CreditCard },
	trial: { label: 'Trial', color: 'bg-[var(--color-orange)] text-white', icon: Clock },
	past_due: {
		label: 'Past Due',
		color: 'bg-[var(--color-danger)] text-white',
		icon: AlertCircle
	},
	cancelled: { label: 'Cancelled', color: 'bg-[var(--color-gray)] text-white', icon: AlertCircle }
};
