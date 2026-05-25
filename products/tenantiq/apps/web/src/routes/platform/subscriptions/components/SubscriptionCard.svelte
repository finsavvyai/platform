<script lang="ts">
	/**
	 * Individual subscription list item with usage metrics and actions
	 */

	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { Users, Activity, Calendar, Building2 } from 'lucide-svelte';
	import { tierInfo, statusInfo } from '../config';
	import {
		formatCurrency,
		formatDate,
		getDaysUntilExpiry,
		getUsagePercentage,
		type Subscription
	} from '../types';

	let { subscription }: { subscription: Subscription } = $props();

	let tier = $derived(tierInfo[subscription.tier]);
	let status = $derived(statusInfo[subscription.status]);
	let userUsage = $derived(getUsagePercentage(subscription.currentUsers, subscription.maxUsers));
	let scanUsage = $derived(
		getUsagePercentage(subscription.currentScans, subscription.maxScansPerMonth)
	);
	let daysUntilExpiry = $derived(
		subscription.trialEndsAt
			? getDaysUntilExpiry(subscription.trialEndsAt)
			: getDaysUntilExpiry(subscription.currentPeriodEnd)
	);
</script>

<Card variant="elevated" padding="none" hoverable clickable>
	<div class="p-6">
		<!-- Header -->
		<div class="flex items-start justify-between mb-4">
			<div class="flex items-center gap-4 flex-1">
				<div
					class="w-12 h-12 rounded-lg {tier.bgColor} bg-opacity-10 flex items-center justify-center"
				>
					<Building2 class="w-6 h-6 {tier.color}" />
				</div>
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<h3 class="text-lg font-semibold text-[var(--color-text)]">
							{subscription.organizationName}
						</h3>
						<span class="px-2 py-0.5 text-xs font-medium rounded-full {status.color}">
							{status.label}
						</span>
						{#if subscription.status === 'trial' && daysUntilExpiry <= 7}
							<span
								class="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--color-orange)] bg-opacity-20 text-[var(--color-orange)]"
							>
								{daysUntilExpiry} days left
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-2 mt-1">
						<span class="text-sm font-medium {tier.color}">{tier.name}</span>
						<span class="text-sm text-[var(--color-text-secondary)]">·</span>
						<span class="text-sm text-[var(--color-text-secondary)]">
							{formatDate(subscription.currentPeriodStart)} - {formatDate(
								subscription.currentPeriodEnd
							)}
						</span>
					</div>
				</div>
			</div>
			<div class="text-right">
				<p class="text-2xl font-semibold text-[var(--color-text)]">
					{formatCurrency(subscription.monthlyPrice)}
					<span class="text-sm font-normal text-[var(--color-text-secondary)]">/mo</span>
				</p>
				{#if subscription.autoRenew}
					<p class="text-xs text-[var(--color-success)] mt-1">Auto-renews</p>
				{:else}
					<p class="text-xs text-[var(--color-text-secondary)] mt-1">Manual renewal</p>
				{/if}
			</div>
		</div>

		<!-- Usage Metrics -->
		<div class="grid grid-cols-2 gap-4">
			<div>
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center gap-2">
						<Users class="w-4 h-4 text-[var(--color-text-secondary)]" />
						<span class="text-sm text-[var(--color-text-secondary)]">Users</span>
					</div>
					<span class="text-sm font-medium text-[var(--color-text)]">
						{subscription.currentUsers} / {subscription.maxUsers}
					</span>
				</div>
				<div class="h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
					<div
						class="h-full rounded-full transition-all {userUsage >= 90
							? 'bg-[var(--color-danger)]'
							: userUsage >= 70
								? 'bg-[var(--color-orange)]'
								: 'bg-[var(--color-success)]'}"
						style="width: {userUsage}%"
					></div>
				</div>
				<p class="text-xs text-[var(--color-text-secondary)] mt-1">{userUsage}% utilized</p>
			</div>

			<div>
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center gap-2">
						<Activity class="w-4 h-4 text-[var(--color-text-secondary)]" />
						<span class="text-sm text-[var(--color-text-secondary)]">Scans</span>
					</div>
					<span class="text-sm font-medium text-[var(--color-text)]">
						{subscription.currentScans} / {subscription.maxScansPerMonth}
					</span>
				</div>
				<div class="h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
					<div
						class="h-full rounded-full transition-all {scanUsage >= 90
							? 'bg-[var(--color-danger)]'
							: scanUsage >= 70
								? 'bg-[var(--color-orange)]'
								: 'bg-[var(--color-primary)]'}"
						style="width: {scanUsage}%"
					></div>
				</div>
				<p class="text-xs text-[var(--color-text-secondary)] mt-1">{scanUsage}% utilized</p>
			</div>
		</div>
	</div>

	<!-- Actions -->
	<div
		class="px-6 py-3 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] flex items-center justify-between"
	>
		<div class="flex items-center gap-2">
			<Calendar class="w-4 h-4 text-[var(--color-text-secondary)]" />
			<span class="text-sm text-[var(--color-text-secondary)]">
				Next billing: {formatDate(subscription.currentPeriodEnd)}
			</span>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="ghost" size="sm">View Details</Button>
			<Button variant="ghost" size="sm">Manage</Button>
			{#if subscription.status === 'past_due'}
				<Button variant="destructive" size="sm">Send Reminder</Button>
			{/if}
		</div>
	</div>
</Card>
