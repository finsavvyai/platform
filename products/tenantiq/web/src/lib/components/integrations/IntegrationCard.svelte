<script lang="ts">
	import { formatRelativeTime } from '$utils/format';

	interface Props {
		provider: string;
		name: string;
		description: string;
		status: 'connected' | 'disconnected' | 'error';
		lastSyncAt: string | null;
		icon?: string;
		href: string;
	}

	let { provider, name, description, status, lastSyncAt, icon, href }: Props = $props();

	let statusColor = $derived(
		status === 'connected' ? 'var(--color-success)' : status === 'error' ? 'var(--color-danger)' : 'var(--color-text-secondary)'
	);
	let statusLabel = $derived(
		status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Not Connected'
	);
</script>

<a
	{href}
	class="group flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all hover:shadow-[var(--shadow-md)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
>
	<div class="flex items-start gap-4">
		<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)] text-2xl">
			{icon ?? '🔌'}
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h3 class="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)]">{name}</h3>
				<span
					class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
					style="background: color-mix(in srgb, {statusColor} 15%, transparent); color: {statusColor}"
				>
					<span class="inline-block h-1.5 w-1.5 rounded-full" style="background: {statusColor}"></span>
					{statusLabel}
				</span>
			</div>
			<p class="mt-1 text-xs text-[var(--color-text-secondary)] line-clamp-2">{description}</p>
		</div>
	</div>

	<div class="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
		{#if status === 'connected' && lastSyncAt}
			<span class="text-xs text-[var(--color-text-secondary)]">
				Synced {formatRelativeTime(lastSyncAt)}
			</span>
		{:else}
			<span class="text-xs text-[var(--color-text-secondary)]">Not configured</span>
		{/if}

		<span class="text-xs font-medium text-[var(--color-primary)]">
			{status === 'connected' ? 'Manage' : 'Connect'} &rarr;
		</span>
	</div>
</a>
