<script lang="ts">
	/**
	 * SyncJobRow — individual sync job entry with retry action.
	 */
	import { formatRelativeTime } from '$utils/format';
	import { CheckCircle, XCircle, Clock, Loader2, RotateCcw } from 'lucide-svelte';

	interface SyncJob {
		id: string;
		tenant_name: string;
		type: string;
		status: string;
		started_at: number | null;
		completed_at: number | null;
		error_message: string | null;
		items_processed: number;
		items_failed: number;
		created_at: number;
	}

	let { job, onretry }: { job: SyncJob; onretry: (id: string) => void } = $props();

	const statusConfig = $derived.by(() => {
		switch (job.status) {
			case 'completed': return { icon: CheckCircle, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/10' };
			case 'failed': return { icon: XCircle, color: 'text-[var(--color-danger)]', bg: 'bg-[var(--color-danger)]/10' };
			case 'running': return { icon: Loader2, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary)]/10' };
			default: return { icon: Clock, color: 'text-[var(--color-text-tertiary)]', bg: 'bg-[var(--color-bg-secondary)]' };
		}
	});

	const duration = $derived.by(() => {
		if (!job.started_at) return '--';
		const end = job.completed_at ?? Math.floor(Date.now() / 1000);
		const sec = end - job.started_at;
		return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
	});
</script>

{#snippet syncIcon()}
	{@const Icon = statusConfig.icon}
	<Icon size={14} class={statusConfig.color} />
{/snippet}

<div class="flex items-center gap-4 px-6 py-3 hover:bg-[var(--color-bg-secondary)] transition-colors border-b border-[var(--color-border)] last:border-b-0">
	<div class="flex items-center gap-2 shrink-0">
		<div class="rounded-full p-1.5 {statusConfig.bg}">
			{@render syncIcon()}
		</div>
	</div>

	<div class="flex-1 min-w-0">
		<div class="flex items-center gap-2">
			<span class="text-sm font-medium text-[var(--color-text)] truncate">{job.tenant_name ?? 'Unknown'}</span>
			<span class="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
				{job.type}
			</span>
		</div>
		{#if job.error_message}
			<p class="text-xs text-[var(--color-danger)] mt-0.5 truncate">{job.error_message}</p>
		{/if}
	</div>

	<div class="flex items-center gap-6 shrink-0 text-xs text-[var(--color-text-secondary)]">
		<span title="Items processed">{job.items_processed} processed</span>
		{#if job.items_failed > 0}
			<span class="text-[var(--color-danger)]" title="Items failed">{job.items_failed} failed</span>
		{/if}
		<span title="Duration">{duration}</span>
		<span title="Created">{formatRelativeTime(job.created_at)}</span>
	</div>

	{#if job.status === 'failed'}
		<button
			onclick={() => onretry(job.id)}
			class="flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
			title="Retry this job"
		>
			<RotateCcw size={12} />
			Retry
		</button>
	{/if}
</div>
