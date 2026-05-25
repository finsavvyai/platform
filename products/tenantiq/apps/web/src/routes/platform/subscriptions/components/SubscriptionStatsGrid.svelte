<script lang="ts">
	/**
	 * Stats grid showing key subscription metrics (6 cards)
	 */

	import Card from '$lib/components/ui/Card.svelte';
	import {
		CreditCard,
		TrendingUp,
		AlertCircle,
		Clock,
		DollarSign,
		Activity
	} from 'lucide-svelte';
	import { formatCurrency, type SubscriptionStats } from '../types';

	let { stats }: { stats: SubscriptionStats } = $props();
</script>

<div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
	<Card variant="elevated" padding="md" hoverable>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-sm font-medium text-[var(--color-text-secondary)]">Active</p>
				<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">
					{stats.activeSubscriptions}
				</p>
			</div>
			<div class="p-3 rounded-lg bg-[var(--color-success)] bg-opacity-10">
				<CreditCard class="w-6 h-6 text-[var(--color-success)]" />
			</div>
		</div>
	</Card>

	<Card variant="elevated" padding="md" hoverable>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-sm font-medium text-[var(--color-text-secondary)]">Trials</p>
				<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">
					{stats.trialAccounts}
				</p>
			</div>
			<div class="p-3 rounded-lg bg-[var(--color-orange)] bg-opacity-10">
				<Clock class="w-6 h-6 text-[var(--color-orange)]" />
			</div>
		</div>
	</Card>

	<Card variant="elevated" padding="md" hoverable>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-sm font-medium text-[var(--color-text-secondary)]">Past Due</p>
				<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">{stats.pastDue}</p>
			</div>
			<div class="p-3 rounded-lg bg-[var(--color-danger)] bg-opacity-10">
				<AlertCircle class="w-6 h-6 text-[var(--color-danger)]" />
			</div>
		</div>
	</Card>

	<Card variant="elevated" padding="md" hoverable>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-sm font-medium text-[var(--color-text-secondary)]">Total MRR</p>
				<p class="text-2xl font-semibold text-[var(--color-text)] mt-2">
					{formatCurrency(stats.totalMRR)}
				</p>
			</div>
			<div class="p-3 rounded-lg bg-[var(--color-primary)] bg-opacity-10">
				<DollarSign class="w-6 h-6 text-[var(--color-primary)]" />
			</div>
		</div>
	</Card>

	<Card variant="elevated" padding="md" hoverable>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-sm font-medium text-[var(--color-text-secondary)]">ARPA</p>
				<p class="text-2xl font-semibold text-[var(--color-text)] mt-2">
					{formatCurrency(stats.avgRevenuePerAccount)}
				</p>
			</div>
			<div class="p-3 rounded-lg bg-[var(--color-green)] bg-opacity-10">
				<TrendingUp class="w-6 h-6 text-[var(--color-green)]" />
			</div>
		</div>
	</Card>

	<Card variant="elevated" padding="md" hoverable>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-sm font-medium text-[var(--color-text-secondary)]">Churn</p>
				<p class="text-2xl font-semibold text-[var(--color-text)] mt-2">
					{stats.churnRate}%
				</p>
			</div>
			<div class="p-3 rounded-lg bg-[var(--color-orange)] bg-opacity-10">
				<Activity class="w-6 h-6 text-[var(--color-orange)]" />
			</div>
		</div>
	</Card>
</div>
