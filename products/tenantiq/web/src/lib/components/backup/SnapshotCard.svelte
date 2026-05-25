<script lang="ts">
	import { formatRelativeTime } from '$utils/format';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';

	interface Props {
		snapshot: {
			id: string; label: string; snapshot_type: string;
			category_count: number; object_count: number; error_count: number;
			is_baseline?: number; baseline_label?: string | null;
			created_by: string; created_at: string;
		};
		onView: (id: string) => void;
		onDiff?: (id: string) => void;
		onSetBaseline?: (id: string) => void;
		onClearBaseline?: (id: string) => void;
		isCompareSource?: boolean;
	}

	let { snapshot, onView, onDiff, onSetBaseline, onClearBaseline, isCompareSource }: Props = $props();
	const isBaseline = $derived(snapshot.is_baseline === 1);

	let expanded = $state(false);
	let categories = $state<string[]>([]);
	let loadingCategories = $state(false);

	async function toggleExpand() {
		if (expanded) { expanded = false; return; }
		expanded = true;
		if (categories.length > 0) return;
		loadingCategories = true;
		try {
			const res = await api.get<{ snapshot: { categories: string[] } }>(
				`/config-snapshots/${snapshot.id}`
			);
			categories = res.snapshot?.categories ?? [];
		} catch {
			toasts.error('Failed to load categories');
		} finally { loadingCategories = false; }
	}
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 hover:border-[var(--color-primary)]/30 hover:shadow-[var(--shadow-sm)] {expanded ? 'border-[var(--color-primary)]/30' : ''}">
	<div role="button" tabindex="0" onclick={toggleExpand} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(); }} class="w-full cursor-pointer p-4 text-left">
		<div class="flex items-start justify-between">
			<div>
				<p class="text-sm font-semibold text-[var(--color-text)]">{snapshot.label}</p>
				<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">
					{snapshot.category_count} categories, {snapshot.object_count} objects
					{#if snapshot.error_count > 0}
						<span class="text-[var(--color-danger)]"> ({snapshot.error_count} errors)</span>
					{/if}
				</p>
			</div>
			<div class="flex items-center gap-2">
				{#if isBaseline}
					<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600" title="Drift detection compares against this snapshot">
						★ Baseline{snapshot.baseline_label ? ` · ${snapshot.baseline_label}` : ''}
					</span>
				{/if}
				{#if isCompareSource}
					<span class="rounded-full bg-[var(--color-primary)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">Comparing…</span>
				{/if}
				<span class="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] capitalize">{snapshot.snapshot_type}</span>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--color-text-tertiary)] transition-transform duration-200 {expanded ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
			</div>
		</div>
		<div class="mt-2 flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
			<span>{formatRelativeTime(snapshot.created_at)} by {snapshot.created_by}</span>
			<div class="flex gap-3">
				{#if onDiff}
					<button type="button" onclick={(e) => { e.stopPropagation(); onDiff?.(snapshot.id); }} class="text-[var(--color-primary)] hover:underline">Compare</button>
				{/if}
				{#if onSetBaseline && !isBaseline}
					<button type="button" onclick={(e) => { e.stopPropagation(); onSetBaseline?.(snapshot.id); }} class="text-emerald-600 hover:underline">Set Baseline</button>
				{/if}
				{#if onClearBaseline && isBaseline}
					<button type="button" onclick={(e) => { e.stopPropagation(); onClearBaseline?.(snapshot.id); }} class="text-amber-600 hover:underline">Clear Baseline</button>
				{/if}
				<button type="button" onclick={(e) => { e.stopPropagation(); onView(snapshot.id); }} class="text-[var(--color-primary)] hover:underline">Full View</button>
			</div>
		</div>
	</div>

	{#if expanded}
		<div class="border-t border-[var(--color-border)] px-4 pb-4 pt-3">
			{#if loadingCategories}
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
					{#each Array(5) as _}<div class="h-9 skeleton rounded-lg"></div>{/each}
				</div>
			{:else if categories.length === 0}
				<p class="text-xs text-[var(--color-text-secondary)]">No category data available.</p>
			{:else}
				<p class="mb-2 text-[11px] font-medium text-[var(--color-text-secondary)]">Categories</p>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
					{#each categories as catId}
						<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-center text-[11px] font-medium text-[var(--color-text)]">
							{catId.replace(/_/g, ' ')}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
