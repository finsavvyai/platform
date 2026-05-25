<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { untrack } from 'svelte';

	interface TrendData {
		dataPoints: { date: string; total: number; critical: number; high: number; medium: number; low: number }[];
		mttr: number; resolutionRate: number; totalAlerts: number;
	}
	interface DistributionData {
		bySeverity: { severity: string; count: number }[];
		topCategories: { category: string; count: number }[];
	}

	let trends = $state<TrendData | null>(null);
	let distribution = $state<DistributionData | null>(null);
	let loading = $state(true);
	let expanded = $state(false);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadAnalytics()); });

	async function loadAnalytics() {
		loading = true;
		try {
			const [t, d] = await Promise.all([
				api.get<TrendData>('/alert-analytics/trends?period=30d'),
				api.get<DistributionData>('/alert-analytics/distribution'),
			]);
			trends = t;
			distribution = d;
		} catch { trends = null; distribution = null; }
		finally { loading = false; }
	}

	const sevColors: Record<string, string> = {
		critical: 'bg-[var(--color-danger)]',
		high: 'bg-orange-500',
		medium: 'bg-[var(--color-warning)]',
		low: 'bg-blue-400',
	};

	const maxCount = $derived(
		distribution?.bySeverity?.reduce((max, s) => Math.max(max, s.count), 0) ?? 1
	);
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
	<button
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-center justify-between p-4 text-left"
	>
		<h2 class="text-sm font-semibold text-[var(--color-text)]">Analytics</h2>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4 text-[var(--color-text-secondary)] transition-transform {expanded ? 'rotate-180' : ''}"
			fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
		><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
	</button>

	{#if expanded}
		<div class="border-t border-[var(--color-border)] p-4 space-y-5">
			{#if loading}
				<div class="space-y-3">
					{#each Array(2) as _}<div class="h-16 skeleton rounded-xl"></div>{/each}
				</div>
			{:else if !trends || !distribution}
				<p class="text-sm text-[var(--color-text-secondary)]">
					Unable to load analytics data.
				</p>
			{:else}
				<!-- Metrics row -->
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
					<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center">
						<p class="text-lg font-bold text-[var(--color-text)]">
							{trends.mttr}<span class="text-xs font-normal text-[var(--color-text-secondary)]">h</span>
						</p>
						<p class="text-[11px] text-[var(--color-text-secondary)]">MTTR</p>
					</div>
					<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center">
						<p class="text-lg font-bold text-[var(--color-text)]">
							{Math.round(trends.resolutionRate * 100)}%
						</p>
						<p class="text-[11px] text-[var(--color-text-secondary)]">Resolution Rate</p>
					</div>
					<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center">
						<p class="text-lg font-bold text-[var(--color-text)]">
							{trends.totalAlerts}
						</p>
						<p class="text-[11px] text-[var(--color-text-secondary)]">Total (30d)</p>
					</div>
				</div>

				<!-- Severity distribution bar -->
				<div>
					<h3 class="mb-3 text-xs font-semibold text-[var(--color-text-secondary)]">
						Severity Distribution
					</h3>
					<div class="space-y-2">
						{#each distribution.bySeverity as sev (sev.severity)}
							<div class="flex items-center gap-3">
								<span class="w-16 text-xs font-medium capitalize text-[var(--color-text)]">
									{sev.severity}
								</span>
								<div class="flex-1 h-5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
									<div
										class="h-full rounded-full transition-all {sevColors[sev.severity] ?? 'bg-[var(--color-border-strong)]'}"
										style="width: {maxCount > 0 ? (sev.count / maxCount) * 100 : 0}%"
									></div>
								</div>
								<span class="w-8 text-right text-xs text-[var(--color-text-secondary)]">
									{sev.count}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
