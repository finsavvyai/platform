<script lang="ts">
	/**
	 * Admin Performance Metrics Page
	 *
	 * API latency, request counts, error rates, sync duration.
	 */
	import MetricsChart from '$lib/components/admin/MetricsChart.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { auth } from '$stores/auth';
	import { formatRelativeTime } from '$utils/format';

	let loading = $state(true);
	let summary = $state<any>(null);
	let recentMetrics = $state<any[]>([]);
	let hoursRange = $state(24);

	$effect(() => {
		if ($auth.user) loadMetrics();
	});

	async function loadMetrics() {
		loading = true;
		try {
			const [summaryRes, metricsRes] = await Promise.all([
				fetch('https://api.tenantiq.app/platform/admin/metrics/summary', {
					credentials: 'include',
				}).then((r) => r.json()),
				fetch(`https://api.tenantiq.app/platform/admin/metrics?hours=${hoursRange}`, {
					credentials: 'include',
				}).then((r) => r.json()),
			]);
			summary = summaryRes;
			recentMetrics = metricsRes.metrics ?? [];
		} catch {
			/* keep defaults */
		} finally {
			loading = false;
		}
	}

	function changeRange(hours: number) {
		hoursRange = hours;
		loadMetrics();
	}
</script>

<svelte:head>
	<title>Metrics - Admin - TenantIQ</title>
</svelte:head>

<div class="flex items-center justify-between mb-4">
	<h2 class="text-lg font-semibold text-[var(--color-text)]">Performance Metrics</h2>
	<div class="flex gap-1">
		{#each [1, 6, 24, 72, 168] as h}
			<button
				onclick={() => changeRange(h)}
				class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer
					{hoursRange === h
						? 'bg-[var(--color-primary)] text-white'
						: 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'}"
			>
				{h < 24 ? `${h}h` : `${h / 24}d`}
			</button>
		{/each}
	</div>
</div>

<MetricsChart data={summary} {loading} />

<!-- Recent Metrics Table -->
<Card variant="elevated" padding="none" class="mt-6">
	<div class="p-4 border-b border-[var(--color-border)]">
		<h3 class="text-sm font-semibold text-[var(--color-text)]">Recent Metric Points ({recentMetrics.length})</h3>
	</div>
	{#if recentMetrics.length === 0 && !loading}
		<div class="p-8 text-center text-sm text-[var(--color-text-secondary)]">No metrics recorded yet</div>
	{:else}
		<div class="max-h-80 overflow-y-auto">
			<table class="w-full text-sm">
				<thead class="sticky top-0 bg-[var(--color-surface)]">
					<tr class="text-left text-xs text-[var(--color-text-secondary)]">
						<th class="px-4 py-2 font-medium">Type</th>
						<th class="px-4 py-2 font-medium">Value</th>
						<th class="px-4 py-2 font-medium">Recorded</th>
					</tr>
				</thead>
				<tbody>
					{#each recentMetrics.slice(0, 100) as m}
						<tr class="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">
							<td class="px-4 py-2 text-[var(--color-text)]">{m.metric_type}</td>
							<td class="px-4 py-2 font-mono text-[var(--color-text)]">{m.value}</td>
							<td class="px-4 py-2 text-[var(--color-text-secondary)]">{formatRelativeTime(m.recorded_at)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</Card>
