<script lang="ts">
	import CategoryBadge from './CategoryBadge.svelte';
	import { formatRelativeTime } from '$utils/format';

	interface Drift {
		id: string;
		category: string;
		path: string;
		old_value: string | null;
		new_value: string | null;
		severity: 'info' | 'warning' | 'critical';
		acknowledged: number;
		detected_at: string;
	}

	interface Props {
		drift: Drift;
		onAcknowledge: (id: string) => void;
		onRevert?: (id: string) => void;
	}

	let { drift, onAcknowledge, onRevert }: Props = $props();

	const severityStyles: Record<string, string> = {
		critical: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5',
		warning: 'border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5',
		info: 'border-[var(--color-border)]',
	};

	const severityDot: Record<string, string> = {
		critical: 'bg-[var(--color-danger)]',
		warning: 'bg-[var(--color-warning)]',
		info: 'bg-[var(--color-text-tertiary)]',
	};

	let style = $derived(severityStyles[drift.severity] ?? severityStyles.info);
	let dot = $derived(severityDot[drift.severity] ?? severityDot.info);

	function truncate(val: string | null): string {
		if (!val) return '(empty)';
		try { val = JSON.parse(val); } catch { /* use raw */ }
		const s = typeof val === 'string' ? val : JSON.stringify(val);
		return s.length > 60 ? s.slice(0, 60) + '...' : s;
	}
</script>

<div class="rounded-xl border p-3 transition-all duration-200 {style} {drift.acknowledged ? 'opacity-60' : ''}">
	<div class="flex items-start justify-between gap-2">
		<div class="flex items-center gap-2">
			<span class="h-2 w-2 rounded-full {dot}"></span>
			<CategoryBadge category={drift.category} />
			<span class="text-xs font-medium text-[var(--color-text)]">{drift.path}</span>
		</div>
		<div class="flex items-center gap-1">
			{#if onRevert && !drift.acknowledged}
				<button
					onclick={() => onRevert?.(drift.id)}
					class="cursor-pointer rounded-lg px-2 py-1 text-[10px] font-medium text-amber-600 transition-colors hover:bg-amber-500/10"
					title="Plan + apply revert via Graph"
				>
					Revert
				</button>
			{/if}
			{#if !drift.acknowledged}
				<button
					onclick={() => onAcknowledge(drift.id)}
					class="cursor-pointer rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/10"
				>
					Acknowledge
				</button>
			{:else}
				<span class="text-[10px] text-[var(--color-text-tertiary)]">Acknowledged</span>
			{/if}
		</div>
	</div>
	<div class="mt-2 space-y-0.5 pl-4 text-[11px] font-mono">
		{#if drift.old_value}
			<p class="text-[var(--color-danger)]">- {truncate(drift.old_value)}</p>
		{/if}
		{#if drift.new_value}
			<p class="text-[var(--color-success)]">+ {truncate(drift.new_value)}</p>
		{/if}
	</div>
	<p class="mt-1.5 pl-4 text-[10px] text-[var(--color-text-tertiary)]">
		{formatRelativeTime(drift.detected_at)}
	</p>
</div>
