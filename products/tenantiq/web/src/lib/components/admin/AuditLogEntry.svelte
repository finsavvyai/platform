<script lang="ts">
	/**
	 * AuditLogEntry — individual audit log row with expandable details.
	 */
	import { formatRelativeTime } from '$utils/format';
	import { ChevronDown, ChevronRight, User, Globe } from 'lucide-svelte';

	interface AuditLog {
		id: string;
		user_email: string | null;
		user_name: string | null;
		action: string;
		resource_type: string | null;
		resource_id: string | null;
		details: Record<string, unknown> | null;
		ip_address: string | null;
		created_at: number;
	}

	let { log }: { log: AuditLog } = $props();
	let expanded = $state(false);

	const actionColor = $derived(() => {
		if (log.action.startsWith('delete')) return 'text-[var(--color-danger)]';
		if (log.action.startsWith('retry')) return 'text-[var(--color-warning)]';
		if (log.action.startsWith('create')) return 'text-[var(--color-success)]';
		return 'text-[var(--color-primary)]';
	});
</script>

<div class="border-b border-[var(--color-border)] last:border-b-0">
	<button
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-center gap-4 px-6 py-3 text-left hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
	>
		<div class="shrink-0">
			{#if expanded}
				<ChevronDown size={14} class="text-[var(--color-text-tertiary)]" />
			{:else}
				<ChevronRight size={14} class="text-[var(--color-text-tertiary)]" />
			{/if}
		</div>

		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium {actionColor()}">{log.action}</span>
				{#if log.resource_type}
					<span class="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
						{log.resource_type}
					</span>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-4 shrink-0 text-xs text-[var(--color-text-secondary)]">
			<span class="flex items-center gap-1">
				<User size={12} />
				{log.user_name ?? log.user_email ?? 'Unknown'}
			</span>
			{#if log.ip_address}
				<span class="flex items-center gap-1">
					<Globe size={12} />
					{log.ip_address}
				</span>
			{/if}
			<span>{formatRelativeTime(log.created_at)}</span>
		</div>
	</button>

	{#if expanded && log.details}
		<div class="px-12 pb-4">
			<pre class="rounded-lg bg-[var(--color-bg-secondary)] p-3 text-xs text-[var(--color-text-secondary)] overflow-x-auto">{JSON.stringify(log.details, null, 2)}</pre>
		</div>
	{/if}
</div>
