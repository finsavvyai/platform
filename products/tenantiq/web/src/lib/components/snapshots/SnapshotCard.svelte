<script lang="ts">
	import CategoryBadge from './CategoryBadge.svelte';
	import { formatRelativeTime } from '$utils/format';

	interface Snapshot {
		id: string;
		label: string;
		snapshot_type: string;
		category_count: number;
		object_count: number;
		error_count: number;
		baseline: number;
		created_by: string;
		created_at: string;
	}

	interface Props {
		snapshot: Snapshot;
		isCompareSource: boolean;
		onView: (id: string) => void;
		onDiff: (id: string) => void;
		onSetBaseline: (id: string) => void;
		onClearBaseline?: (id: string) => void;
	}

	let { snapshot, isCompareSource, onView, onDiff, onSetBaseline, onClearBaseline }: Props = $props();
</script>

<div
	class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all duration-200 hover:border-[var(--color-primary)]/30 hover:shadow-[var(--shadow-sm)] {isCompareSource ? 'ring-2 ring-[var(--color-primary)]/40' : ''}"
>
	<div class="flex items-start justify-between">
		<div>
			<div class="flex items-center gap-2">
				<p class="text-sm font-semibold text-[var(--color-text)]">{snapshot.label}</p>
				{#if snapshot.baseline}
					<span class="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
						Baseline
					</span>
				{/if}
			</div>
			<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">
				{snapshot.category_count} categories, {snapshot.object_count} objects
				{#if snapshot.error_count > 0}
					<span class="text-[var(--color-danger)]"> ({snapshot.error_count} errors)</span>
				{/if}
			</p>
		</div>
		<span class="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] capitalize">
			{snapshot.snapshot_type}
		</span>
	</div>

	<div class="mt-3 flex items-center justify-between">
		<span class="text-[11px] text-[var(--color-text-tertiary)]">
			{formatRelativeTime(snapshot.created_at)} by {snapshot.created_by}
		</span>
		<div class="flex gap-2">
			{#if !snapshot.baseline}
				<button
					onclick={() => onSetBaseline(snapshot.id)}
					class="cursor-pointer text-[11px] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)]"
				>Set Baseline</button>
			{/if}
			<button
				onclick={() => onDiff(snapshot.id)}
				class="cursor-pointer text-[11px] text-[var(--color-primary)] hover:underline"
			>Compare</button>
			<button
				onclick={() => onView(snapshot.id)}
				class="cursor-pointer text-[11px] text-[var(--color-primary)] hover:underline"
			>View</button>
		</div>
	</div>
</div>
