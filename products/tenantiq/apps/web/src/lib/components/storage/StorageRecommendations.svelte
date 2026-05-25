<script lang="ts">
	interface Recommendation {
		id: string;
		type: string;
		severity: 'low' | 'medium' | 'high';
		title: string;
		description: string;
		potentialSavingsGB: number;
		affectedItems: number;
	}

	interface Props {
		recommendations: Recommendation[];
	}

	let { recommendations }: Props = $props();

	const severityStyles: Record<string, string> = {
		high: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5',
		medium: 'border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5',
		low: 'border-[var(--color-border)] bg-[var(--color-surface)]',
	};

	const severityDot: Record<string, string> = {
		high: 'bg-[var(--color-danger)]',
		medium: 'bg-[var(--color-warning)]',
		low: 'bg-[var(--color-text-tertiary)]',
	};

	const typeLabels: Record<string, string> = {
		cleanup: 'Cleanup',
		quota: 'Quota',
		license: 'License',
		archive: 'Archive',
		optimization: 'Optimization',
	};
</script>

<div class="space-y-3">
	<h3 class="text-sm font-semibold text-[var(--color-text)]">Recommendations</h3>

	{#if recommendations.length === 0}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
			No recommendations yet. Run a scan to generate insights.
		</div>
	{:else}
		{#each recommendations as rec (rec.id)}
			<div class="rounded-2xl border p-4 {severityStyles[rec.severity] || severityStyles.low}">
				<div class="flex items-start gap-3">
					<div class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full {severityDot[rec.severity]}"></div>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<h4 class="text-sm font-medium text-[var(--color-text)]">{rec.title}</h4>
							<span class="rounded-md bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
								{typeLabels[rec.type] || rec.type}
							</span>
						</div>
						<p class="mt-1 text-xs text-[var(--color-text-secondary)]">{rec.description}</p>
						<div class="mt-2 flex gap-4 text-xs text-[var(--color-text-secondary)]">
							{#if rec.potentialSavingsGB > 0}
								<span>Potential savings: <strong class="text-[var(--color-success)]">{rec.potentialSavingsGB} GB</strong></span>
							{/if}
							<span>Affected: <strong>{rec.affectedItems}</strong> items</span>
						</div>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
