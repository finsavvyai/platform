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
		href: string;
	}

	let { summary, href }: Props = $props();
</script>

{#if summary.total > 0}
	<a
		{href}
		class="flex items-center justify-between rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 px-5 py-3 transition-colors hover:border-[var(--color-warning)]/50 hover:bg-[var(--color-warning)]/10"
		aria-label="View {summary.total} configuration drift events"
	>
		<div class="flex items-center gap-3">
			<!-- Warning icon -->
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-[var(--color-warning)]" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
			</svg>
			<span class="text-sm font-semibold text-[var(--color-text)]">
				{summary.total} configuration drift{summary.total !== 1 ? 's' : ''} detected
			</span>
		</div>
		<div class="flex items-center gap-2">
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
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--color-text-tertiary)]" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
			</svg>
		</div>
	</a>
{/if}
