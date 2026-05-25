<script lang="ts">
	/**
	 * MetricsChart — time-series bar chart for platform metrics.
	 * Pure CSS implementation (no chart library dependency).
	 */
	import Card from '$lib/components/ui/Card.svelte';

	interface MetricsSummary {
		apiLatency: { avgMs: number; maxMs: number; minMs: number };
		errorRate: { avg: number; samples: number };
		syncDuration: { avgSec: number; maxSec: number };
		activeUsers: number;
	}

	let { data, loading = false }: { data: MetricsSummary | null; loading?: boolean } = $props();
</script>

{#if loading}
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each Array(4) as _}
			<Card variant="elevated" padding="md">
				<div class="animate-pulse space-y-3">
					<div class="h-4 w-20 rounded bg-[var(--color-bg-secondary)]"></div>
					<div class="h-10 w-16 rounded bg-[var(--color-bg-secondary)]"></div>
				</div>
			</Card>
		{/each}
	</div>
{:else if data}
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		<Card variant="elevated" padding="md">
			<p class="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Avg Latency</p>
			<p class="mt-2 text-2xl font-semibold text-[var(--color-text)]">{data.apiLatency.avgMs}ms</p>
			<div class="mt-2 flex gap-3 text-xs text-[var(--color-text-secondary)]">
				<span>Min: {data.apiLatency.minMs}ms</span>
				<span>Max: {data.apiLatency.maxMs}ms</span>
			</div>
			<div class="mt-3 h-2 rounded-full bg-[var(--color-bg-secondary)]">
				<div
					class="h-2 rounded-full transition-all"
					class:bg-[var(--color-success)]={data.apiLatency.avgMs < 200}
					class:bg-[var(--color-warning)]={data.apiLatency.avgMs >= 200 && data.apiLatency.avgMs < 500}
					class:bg-[var(--color-danger)]={data.apiLatency.avgMs >= 500}
					style="width: {Math.min((data.apiLatency.avgMs / 1000) * 100, 100)}%"
				></div>
			</div>
		</Card>

		<Card variant="elevated" padding="md">
			<p class="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Error Rate</p>
			<p class="mt-2 text-2xl font-semibold text-[var(--color-text)]">{data.errorRate.avg}%</p>
			<p class="mt-2 text-xs text-[var(--color-text-secondary)]">{data.errorRate.samples} samples (24h)</p>
			<div class="mt-3 h-2 rounded-full bg-[var(--color-bg-secondary)]">
				<div
					class="h-2 rounded-full transition-all"
					class:bg-[var(--color-success)]={data.errorRate.avg < 1}
					class:bg-[var(--color-warning)]={data.errorRate.avg >= 1 && data.errorRate.avg < 5}
					class:bg-[var(--color-danger)]={data.errorRate.avg >= 5}
					style="width: {Math.min(data.errorRate.avg * 10, 100)}%"
				></div>
			</div>
		</Card>

		<Card variant="elevated" padding="md">
			<p class="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Avg Sync Duration</p>
			<p class="mt-2 text-2xl font-semibold text-[var(--color-text)]">{data.syncDuration.avgSec}s</p>
			<p class="mt-2 text-xs text-[var(--color-text-secondary)]">Max: {data.syncDuration.maxSec}s</p>
			<div class="mt-3 h-2 rounded-full bg-[var(--color-bg-secondary)]">
				<div
					class="h-2 rounded-full transition-all"
					class:bg-[var(--color-success)]={data.syncDuration.avgSec < 30}
					class:bg-[var(--color-warning)]={data.syncDuration.avgSec >= 30 && data.syncDuration.avgSec < 120}
					class:bg-[var(--color-danger)]={data.syncDuration.avgSec >= 120}
					style="width: {Math.min((data.syncDuration.avgSec / 300) * 100, 100)}%"
				></div>
			</div>
		</Card>

		<Card variant="elevated" padding="md">
			<p class="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Active Users</p>
			<p class="mt-2 text-2xl font-semibold text-[var(--color-text)]">{data.activeUsers}</p>
			<p class="mt-2 text-xs text-[var(--color-text-secondary)]">Currently online</p>
		</Card>
	</div>
{/if}
