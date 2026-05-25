<script lang="ts">
	interface DriftSummaryData {
		total: number;
		critical: number;
		warning: number;
		info: number;
		unacknowledged: number;
	}

	interface Props {
		summary: DriftSummaryData;
		onViewDrifts: () => void;
		onAcknowledgeAll: () => void;
	}

	let { summary, onViewDrifts, onAcknowledgeAll }: Props = $props();

	let hasDrifts = $derived(summary.total > 0);
</script>

{#if hasDrifts}
	<div class="rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-4">
		<div class="flex items-start justify-between">
			<div>
				<h3 class="text-sm font-semibold text-[var(--color-text)]">
					Configuration Drift Detected
				</h3>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">
					{summary.unacknowledged} unacknowledged drift{summary.unacknowledged !== 1 ? 's' : ''} found
				</p>
			</div>
			<div class="flex items-center gap-3">
				{#if summary.critical > 0}
					<span class="rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-danger)]">
						{summary.critical} Critical
					</span>
				{/if}
				{#if summary.warning > 0}
					<span class="rounded-full bg-[var(--color-warning)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
						{summary.warning} Warning
					</span>
				{/if}
				{#if summary.info > 0}
					<span class="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
						{summary.info} Info
					</span>
				{/if}
			</div>
		</div>

		<div class="mt-3 flex items-center gap-2">
			<button
				onclick={onViewDrifts}
				class="cursor-pointer rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
			>
				View Drifts
			</button>
			{#if summary.unacknowledged > 0}
				<button
					onclick={onAcknowledgeAll}
					class="cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)]/30"
				>
					Acknowledge All
				</button>
			{/if}
		</div>
	</div>
{/if}
