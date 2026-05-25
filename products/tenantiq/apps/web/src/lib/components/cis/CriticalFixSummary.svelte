<script lang="ts">
	interface FailedControl {
		controlId: string;
		title: string;
		severity: string;
		portalUrl?: string;
	}

	interface Props {
		controls: FailedControl[];
	}

	let { controls }: Props = $props();

	const criticalFails = $derived(
		controls
			.filter(c => c.severity === 'critical' || c.severity === 'high')
			.slice(0, 5)
	);

	const severityColors: Record<string, string> = {
		critical: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
		high: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
	};
</script>

{#if criticalFails.length > 0}
	<div class="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-5">
		<div class="flex items-center gap-2 mb-3">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
			</svg>
			<h3 class="text-sm font-semibold text-[var(--color-text)]">Top Fixes for Maximum Impact</h3>
		</div>
		<ul class="space-y-2">
			{#each criticalFails as ctrl}
				<li class="flex items-center justify-between gap-3">
					<div class="flex items-center gap-2 min-w-0">
						<span class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase {severityColors[ctrl.severity]}">
							{ctrl.severity}
						</span>
						<span class="text-xs font-mono text-[var(--color-text-tertiary)] shrink-0">{ctrl.controlId}</span>
						<span class="text-sm text-[var(--color-text)] truncate">{ctrl.title}</span>
					</div>
					{#if ctrl.portalUrl}
						<a href={ctrl.portalUrl} target="_blank" rel="noopener noreferrer"
							class="shrink-0 inline-flex min-h-[32px] items-center rounded-lg bg-[var(--color-danger)] px-3 py-1 text-[11px] font-medium text-white transition-all hover:bg-[var(--color-danger)]/90">
							Fix Now
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}
