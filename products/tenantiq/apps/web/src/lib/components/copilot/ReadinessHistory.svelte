<script lang="ts">
	import ScoreTrendChart from '$components/ScoreTrendChart.svelte';

	interface HistoryEntry {
		id: string;
		score: number;
		categoryScores: Record<string, number>;
		assessedAt: string;
	}

	interface Props {
		history: HistoryEntry[];
	}

	let { history }: Props = $props();
	let detailOpen = $state(false);

	const trendData = $derived(history.map((h) => ({ score: h.score, date: h.assessedAt })));
	const reversed = $derived([...history].reverse());
</script>

<div class="animate-fade-up delay-2 space-y-4">
	<!-- Trend Chart -->
	{#if trendData.length > 0}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<h3 class="mb-3 text-sm font-semibold text-[var(--color-text)]">Readiness Score Trend</h3>
			<ScoreTrendChart data={trendData} height={200} />
		</div>
	{/if}

	<!-- History list -->
	{#if history.length > 0}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<button
				onclick={() => (detailOpen = !detailOpen)}
				class="flex w-full cursor-pointer items-center justify-between text-left"
				aria-expanded={detailOpen}
			>
				<h3 class="text-sm font-semibold text-[var(--color-text)]">
					Assessment History ({history.length})
				</h3>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4 text-[var(--color-text-secondary)] transition-transform duration-200 {detailOpen ? 'rotate-180' : ''}"
					fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
				</svg>
			</button>

			{#if detailOpen}
				<div class="mt-3 space-y-2">
					{#each reversed as entry}
						<div class="flex items-center justify-between rounded-lg bg-[var(--color-bg)] px-3 py-2">
							<span class="text-xs text-[var(--color-text-secondary)]">
								{new Date(entry.assessedAt).toLocaleString()}
							</span>
							<span
								class="text-sm font-semibold"
								style="color: {entry.score >= 70 ? 'var(--color-success)' : entry.score >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'}"
							>
								{entry.score}%
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
