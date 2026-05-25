<script lang="ts">
	import type { Alert } from '$lib/types/shared';
	import SeverityBadge from './SeverityBadge.svelte';
	import AlertDetailPanel from './AlertDetailPanel.svelte';

	interface Props {
		alert: Alert;
		onRemediate?: (alert: Alert) => void;
		onDismiss?: (alert: Alert) => void;
	}

	let { alert, onRemediate, onDismiss }: Props = $props();
	let detailOpen = $state(false);

	// Determine if this alert has a navigable snapshot diff
	const diffHref = $derived.by(() => {
		const meta = (alert as any).metadata as Record<string, unknown> | undefined;
		const isConfigDrift =
			(alert as any).alertType === 'config_drift' ||
			(alert as any).alert_type === 'config_drift' ||
			(alert as any).type === 'config_drift';
		if (!isConfigDrift || !meta?.snapshotId) return null;
		return `/backups/config/compare?from=${meta.baselineId}&to=${meta.snapshotId}`;
	});
</script>

<button
	type="button"
	onclick={() => (detailOpen = true)}
	class="alert-card group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-xs)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
	aria-label="View details for alert: {alert.title}"
>
	<!-- Severity accent strip -->
	<div class="absolute left-0 top-0 h-full w-1 {alert.severity === 'critical' ? 'bg-gradient-to-b from-[#ef4444] to-[#dc2626]' : alert.severity === 'high' ? 'bg-gradient-to-b from-[#f59e0b] to-[#d97706]' : alert.severity === 'medium' ? 'bg-gradient-to-b from-[#eab308] to-[#ca8a04]' : 'bg-gradient-to-b from-[#3b82f6] to-[#2563eb]'}"></div>

	<div class="flex items-start justify-between gap-3 pl-2">
		<div class="flex min-w-0 items-start gap-3">
			<SeverityBadge severity={alert.severity} />
			<div class="min-w-0 flex-1">
				<h3 class="truncate text-sm font-semibold tracking-tight text-[var(--color-text)]">{alert.title}</h3>
				<p class="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">{alert.description}</p>
			</div>
		</div>
		<span class="shrink-0 text-[var(--color-text-tertiary)] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-primary)]">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
		</span>
	</div>
	{#if alert.businessImpact}
		<div class="mt-3 ml-11 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
			<span class="truncate">{alert.businessImpact}</span>
		</div>
	{/if}
	{#if diffHref}
		<div class="mt-2 ml-11">
			<a
				href={diffHref}
				onclick={(e) => e.stopPropagation()}
				class="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
				aria-label="View configuration diff for this alert"
			>
				View diff
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
				</svg>
			</a>
		</div>
	{/if}
</button>

{#if detailOpen}
	<AlertDetailPanel
		{alert}
		onClose={() => (detailOpen = false)}
		{onRemediate}
		{onDismiss}
	/>
{/if}

<style>
	.alert-card:hover span svg {
		transform: translateX(2px);
		transition: transform var(--duration-fast, 200ms) var(--easing, ease-out);
	}
</style>
