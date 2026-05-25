<script lang="ts">
	/**
	 * Filter bar for subscription status and tier
	 */

	import Card from '$lib/components/ui/Card.svelte';
	import { Filter } from 'lucide-svelte';
	import type { SubscriptionStatus, SubscriptionTier } from '../types';

	let {
		selectedStatus = $bindable('all'),
		selectedTier = $bindable('all'),
		filteredCount,
		totalCount
	}: {
		selectedStatus: SubscriptionStatus | 'all';
		selectedTier: SubscriptionTier | 'all';
		filteredCount: number;
		totalCount: number;
	} = $props();
</script>

<Card variant="elevated" padding="md" class="mb-6">
	<div class="flex items-center gap-4 flex-wrap">
		<div class="flex items-center gap-2">
			<Filter class="w-4 h-4 text-[var(--color-text-secondary)]" />
			<span class="text-sm font-medium text-[var(--color-text)]">Filter by:</span>
		</div>

		<!-- Status Filter -->
		<div class="flex items-center gap-2">
			<button
				onclick={() => (selectedStatus = 'all')}
				class="px-3 py-1.5 text-sm rounded-lg transition-all {selectedStatus === 'all'
					? 'bg-[var(--color-primary)] text-white'
					: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
			>
				All Status
			</button>
			<button
				onclick={() => (selectedStatus = 'active')}
				class="px-3 py-1.5 text-sm rounded-lg transition-all {selectedStatus === 'active'
					? 'bg-[var(--color-success)] text-white'
					: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
			>
				Active
			</button>
			<button
				onclick={() => (selectedStatus = 'trial')}
				class="px-3 py-1.5 text-sm rounded-lg transition-all {selectedStatus === 'trial'
					? 'bg-[var(--color-orange)] text-white'
					: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
			>
				Trial
			</button>
			<button
				onclick={() => (selectedStatus = 'past_due')}
				class="px-3 py-1.5 text-sm rounded-lg transition-all {selectedStatus === 'past_due'
					? 'bg-[var(--color-danger)] text-white'
					: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
			>
				Past Due
			</button>
		</div>

		<div class="h-6 w-px bg-[var(--color-border)]"></div>

		<!-- Tier Filter -->
		<div class="flex items-center gap-2">
			<button
				onclick={() => (selectedTier = 'all')}
				class="px-3 py-1.5 text-sm rounded-lg transition-all {selectedTier === 'all'
					? 'bg-[var(--color-primary)] text-white'
					: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
			>
				All Tiers
			</button>
			<button
				onclick={() => (selectedTier = 'core')}
				class="px-3 py-1.5 text-sm rounded-lg transition-all {selectedTier === 'core'
					? 'bg-[var(--color-primary)] text-white'
					: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
			>
				Core
			</button>
			<button
				onclick={() => (selectedTier = 'professional')}
				class="px-3 py-1.5 text-sm rounded-lg transition-all {selectedTier === 'professional'
					? 'bg-purple-600 text-white'
					: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
			>
				Professional
			</button>
			<button
				onclick={() => (selectedTier = 'security_suite')}
				class="px-3 py-1.5 text-sm rounded-lg transition-all {selectedTier === 'security_suite'
					? 'bg-[var(--color-orange)] text-white'
					: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
			>
				Security Suite
			</button>
			<button
				onclick={() => (selectedTier = 'enterprise')}
				class="px-3 py-1.5 text-sm rounded-lg transition-all {selectedTier === 'enterprise'
					? 'bg-[var(--color-green)] text-white'
					: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
			>
				Enterprise
			</button>
		</div>

		<div class="ml-auto text-sm text-[var(--color-text-secondary)]">
			Showing {filteredCount} of {totalCount} subscriptions
		</div>
	</div>
</Card>
