<script lang="ts">
	import { untrack } from 'svelte';
	import CategoryBadge from './CategoryBadge.svelte';

	interface DiffEntry {
		path: string;
		type: 'added' | 'removed' | 'changed';
		oldValue?: unknown;
		newValue?: unknown;
	}

	interface CategoryDiff {
		categoryId: string;
		name: string;
		changes: DiffEntry[];
		changeCount: number;
	}

	interface Props {
		diffs: CategoryDiff[];
		totalChanges: number;
		snapshotALabel: string;
		snapshotBLabel: string;
		onClose: () => void;
	}

	let { diffs, totalChanges, snapshotALabel, snapshotBLabel, onClose }: Props = $props();

	const typeStyles: Record<string, { badge: string; label: string }> = {
		added: { badge: 'bg-[var(--color-success)]/10 text-[var(--color-success)]', label: 'Added' },
		removed: { badge: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]', label: 'Removed' },
		changed: { badge: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]', label: 'Changed' },
	};

	function truncate(val: unknown): string {
		const s = typeof val === 'string' ? val : JSON.stringify(val);
		return s && s.length > 80 ? s.slice(0, 80) + '...' : s || '(empty)';
	}

	let expandedCats = $state<Set<string>>(new Set(untrack(() => diffs).map(d => d.categoryId)));

	function toggleCategory(catId: string) {
		const next = new Set(expandedCats);
		if (next.has(catId)) next.delete(catId);
		else next.add(catId);
		expandedCats = next;
	}
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h3 class="text-sm font-semibold text-[var(--color-text)]">
				Configuration Diff — {totalChanges} change{totalChanges !== 1 ? 's' : ''}
			</h3>
			<p class="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
				{snapshotALabel} &rarr; {snapshotBLabel}
			</p>
		</div>
		<button onclick={onClose} class="cursor-pointer text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
			Close
		</button>
	</div>

	{#if diffs.length === 0}
		<p class="text-sm text-[var(--color-text-secondary)]">No differences found.</p>
	{:else}
		<div class="space-y-3">
			{#each diffs as cat (cat.categoryId)}
				<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
					<button
						onclick={() => toggleCategory(cat.categoryId)}
						class="flex w-full cursor-pointer items-center justify-between px-3 py-2"
					>
						<div class="flex items-center gap-2">
							<CategoryBadge category={cat.categoryId} size="md" />
							<span class="text-xs font-medium text-[var(--color-text)]">{cat.changeCount} change{cat.changeCount !== 1 ? 's' : ''}</span>
						</div>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--color-text-tertiary)] transition-transform {expandedCats.has(cat.categoryId) ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
						</svg>
					</button>

					{#if expandedCats.has(cat.categoryId)}
						<div class="space-y-1 border-t border-[var(--color-border)] px-3 pb-3 pt-2">
							{#each cat.changes as change (change.path)}
								{@const style = typeStyles[change.type] ?? typeStyles.changed}
								<div class="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs">
									<span class="mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold {style.badge}">
										{style.label}
									</span>
									<div class="min-w-0 flex-1">
										<p class="font-mono text-[var(--color-text)]">{change.path}</p>
										{#if change.type === 'changed'}
											<p class="mt-0.5 text-[var(--color-danger)]">- {truncate(change.oldValue)}</p>
											<p class="text-[var(--color-success)]">+ {truncate(change.newValue)}</p>
										{:else if change.type === 'added'}
											<p class="mt-0.5 text-[var(--color-success)]">+ {truncate(change.newValue)}</p>
										{:else}
											<p class="mt-0.5 text-[var(--color-danger)]">- {truncate(change.oldValue)}</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
