<script lang="ts">
	/**
	 * TenantIQ Subscription Management
	 *
	 * Apple HIG-compliant interface for managing:
	 * - Active subscriptions
	 * - Trial accounts
	 * - Past due subscriptions
	 * - Usage metrics
	 * - Revenue tracking
	 */

	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { CreditCard, Download, Filter } from 'lucide-svelte';
	import type { Subscription, SubscriptionStatus, SubscriptionTier } from './types';
	import SubscriptionStatsGrid from './components/SubscriptionStatsGrid.svelte';
	import SubscriptionFilters from './components/SubscriptionFilters.svelte';
	import SubscriptionCard from './components/SubscriptionCard.svelte';

	let subscriptions = $state<Subscription[]>([]);

	let stats = $derived({
		activeSubscriptions: subscriptions.filter((s) => s.status === 'active').length,
		trialAccounts: subscriptions.filter((s) => s.status === 'trial').length,
		pastDue: subscriptions.filter((s) => s.status === 'past_due').length,
		totalMRR: subscriptions
			.filter((s) => s.status === 'active')
			.reduce((sum, s) => sum + s.monthlyPrice, 0),
		avgRevenuePerAccount:
			subscriptions.length > 0
				? Math.round(
						subscriptions.reduce((sum, s) => sum + s.monthlyPrice, 0) / subscriptions.length
					)
				: 0,
		churnRate: 0
	});

	let selectedStatus = $state<SubscriptionStatus | 'all'>('all');
	let selectedTier = $state<SubscriptionTier | 'all'>('all');

	let filteredSubscriptions = $derived(
		subscriptions.filter((sub) => {
			const statusMatch = selectedStatus === 'all' || sub.status === selectedStatus;
			const tierMatch = selectedTier === 'all' || sub.tier === selectedTier;
			return statusMatch && tierMatch;
		})
	);
</script>

<svelte:head>
	<title>Subscriptions - TenantIQ Platform</title>
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg-secondary)]">
	<!-- Header -->
	<header
		class="sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[var(--color-border)] backdrop-blur-lg bg-opacity-90"
	>
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between h-16">
				<div>
					<h1 class="text-2xl font-semibold text-[var(--color-text)]">Subscriptions</h1>
					<p class="text-sm text-[var(--color-text-secondary)]">
						Manage customer subscriptions and billing
					</p>
				</div>
				<div class="flex items-center gap-2">
					<Button variant="ghost">
						<Download class="w-4 h-4" />
						Export
					</Button>
					<Button variant="primary">
						<Filter class="w-4 h-4" />
						Filters
					</Button>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<SubscriptionStatsGrid {stats} />

		<SubscriptionFilters
			bind:selectedStatus
			bind:selectedTier
			filteredCount={filteredSubscriptions.length}
			totalCount={subscriptions.length}
		/>

		<!-- Subscriptions List -->
		<div class="space-y-4">
			{#each filteredSubscriptions as subscription}
				<SubscriptionCard {subscription} />
			{/each}
		</div>

		<!-- Empty State -->
		{#if filteredSubscriptions.length === 0}
			<Card variant="elevated" padding="lg">
				<div class="text-center py-12">
					<CreditCard class="w-16 h-16 text-[var(--color-text-tertiary)] mx-auto mb-4" />
					<h3 class="text-lg font-semibold text-[var(--color-text)] mb-2">
						No subscriptions found
					</h3>
					<p class="text-sm text-[var(--color-text-secondary)] mb-6">
						Try adjusting your filters to see more results
					</p>
					<Button
						variant="primary"
						onclick={() => {
							selectedStatus = 'all';
							selectedTier = 'all';
						}}
					>
						Clear Filters
					</Button>
				</div>
			</Card>
		{/if}
	</main>
</div>

<style>
	header {
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}
</style>
