<script lang="ts">
	interface Recommendation {
		category: string;
		priority: 'critical' | 'high' | 'medium' | 'low';
		title: string;
		description: string;
	}

	interface Props {
		recommendations: Recommendation[];
	}

	let { recommendations }: Props = $props();

	const priorityStyles: Record<string, string> = {
		critical: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
		high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
		medium: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
		low: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
	};

	const categoryLabels: Record<string, string> = {
		licensing: 'Licensing',
		identityAccess: 'Identity & Access',
		dataProtection: 'Data Protection',
		compliance: 'Compliance',
		security: 'Security',
		collaboration: 'Collaboration',
		dataQuality: 'Data Quality',
	};
</script>

<div class="animate-fade-up delay-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h3 class="mb-3 text-sm font-semibold text-[var(--color-text)]">
		Recommendations ({recommendations.length})
	</h3>
	<div class="space-y-2">
		{#each recommendations as rec, i}
			<div class="flex items-start gap-3 rounded-lg bg-[var(--color-bg)] p-3">
				<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]">
					{i + 1}
				</span>
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<span class="text-sm font-medium text-[var(--color-text)]">{rec.title}</span>
						<span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase {priorityStyles[rec.priority]}">
							{rec.priority}
						</span>
						<span class="text-[10px] text-[var(--color-text-tertiary)]">
							{categoryLabels[rec.category] ?? rec.category}
						</span>
					</div>
					<p class="mt-1 text-xs text-[var(--color-text-secondary)]">{rec.description}</p>
				</div>
			</div>
		{/each}
	</div>
</div>
