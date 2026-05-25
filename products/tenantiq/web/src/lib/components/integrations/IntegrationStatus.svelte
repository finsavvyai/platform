<script lang="ts">
	import { formatRelativeTime } from '$utils/format';

	interface Props {
		provider: string;
		status: 'connected' | 'disconnected' | 'error' | 'syncing';
		lastSyncAt: string | null;
		errorCount: number;
		onResync?: () => void;
		onViewLogs?: () => void;
	}

	let { provider, status, lastSyncAt, errorCount, onResync, onViewLogs }: Props = $props();

	let healthColor = $derived(
		status === 'connected' && errorCount === 0
			? 'var(--color-success)'
			: status === 'connected' && errorCount > 0
				? 'var(--color-warning)'
				: status === 'syncing'
					? 'var(--color-primary)'
					: 'var(--color-danger)'
	);

	let healthLabel = $derived(
		status === 'connected' && errorCount === 0
			? 'Healthy'
			: status === 'connected' && errorCount > 0
				? 'Degraded'
				: status === 'syncing'
					? 'Syncing'
					: status === 'error'
						? 'Error'
						: 'Disconnected'
	);
</script>

<div class="flex items-center gap-3 text-sm">
	<span
		class="inline-block h-2.5 w-2.5 rounded-full"
		class:animate-pulse={status === 'syncing'}
		style="background: {healthColor}"
		title={healthLabel}
	></span>

	<span class="text-[var(--color-text-secondary)]">{healthLabel}</span>

	{#if lastSyncAt}
		<span class="text-xs text-[var(--color-text-secondary)]">
			Last sync {formatRelativeTime(lastSyncAt)}
		</span>
	{/if}

	{#if errorCount > 0}
		<span class="rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
			{errorCount} error{errorCount !== 1 ? 's' : ''}
		</span>
	{/if}

	{#if onResync}
		<button
			onclick={onResync}
			disabled={status === 'syncing'}
			class="ml-auto rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
		>
			{status === 'syncing' ? 'Syncing...' : 'Re-sync'}
		</button>
	{/if}

	{#if onViewLogs}
		<button
			onclick={onViewLogs}
			class="rounded-md px-2.5 py-1 text-xs text-[var(--color-primary)] hover:underline"
		>
			View Logs
		</button>
	{/if}
</div>
