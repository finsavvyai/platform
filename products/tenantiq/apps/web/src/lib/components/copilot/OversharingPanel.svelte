<script lang="ts">
	interface Props {
		overshareRiskCount: number;
		labelGapCount: number;
	}
	let { overshareRiskCount, labelGapCount }: Props = $props();
</script>

<div class="grid gap-4 sm:grid-cols-2">
	<!-- Oversharing risk (COP-03) -->
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
		<div class="flex items-start justify-between">
			<div>
				<p class="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
					Oversharing Risk Signal
				</p>
				<p class="mt-1 text-2xl font-bold text-[var(--color-text)]">{overshareRiskCount}</p>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Public groups (v1 proxy)</p>
			</div>
			{#if overshareRiskCount > 0}
				<span class="rounded-full bg-[var(--color-warning)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
					Review
				</span>
			{:else}
				<span class="rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
					Low Risk
				</span>
			{/if}
		</div>
		<p class="mt-3 text-xs text-[var(--color-text-tertiary)]">
			Per-user sharing report available in Microsoft Purview (v2 feature).
		</p>
	</div>

	<!-- Sensitivity label coverage (COP-04) -->
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
		<div class="flex items-start justify-between">
			<div>
				<p class="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
					Sensitivity Labels Published
				</p>
				<p class="mt-1 text-2xl font-bold text-[var(--color-text)]">{labelGapCount}</p>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Labels in information protection policy</p>
			</div>
			{#if labelGapCount >= 3}
				<span class="rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
					Adequate
				</span>
			{:else}
				<span class="rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-danger)]">
					Gap
				</span>
			{/if}
		</div>
		<p class="mt-3 text-xs text-[var(--color-text-tertiary)]">
			Inspect unlabeled content in Microsoft Purview to close the coverage gap.
		</p>
	</div>
</div>
