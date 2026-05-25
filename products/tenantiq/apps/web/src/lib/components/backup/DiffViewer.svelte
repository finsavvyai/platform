<script lang="ts">
	interface DiffEntry { path: string; type: 'added' | 'removed' | 'changed'; oldValue?: unknown; newValue?: unknown }
	interface CategoryDiff { categoryId: string; name: string; changes: DiffEntry[]; changeCount: number }

	interface Props {
		diffs: CategoryDiff[];
		totalChanges: number;
		onClose: () => void;
	}

	let { diffs, totalChanges, onClose }: Props = $props();

	const typeColors: Record<string, string> = {
		added: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
		removed: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
		changed: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
	};

	function truncate(val: unknown): string {
		const s = typeof val === 'string' ? val : JSON.stringify(val);
		return s && s.length > 80 ? s.slice(0, 80) + '...' : s || '(empty)';
	}
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--color-text)]">Configuration Diff — {totalChanges} change{totalChanges !== 1 ? 's' : ''}</h3>
		<button onclick={onClose} class="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Close</button>
	</div>

	{#if diffs.length === 0}
		<p class="text-sm text-[var(--color-text-secondary)]">No differences found between snapshots.</p>
	{:else}
		<div class="space-y-4">
			{#each diffs as cat}
				<div>
					<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{cat.name} ({cat.changeCount})</p>
					<div class="space-y-1">
						{#each cat.changes as change}
							<div class="flex items-start gap-2 rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs">
								<span class="mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize {typeColors[change.type]}">{change.type}</span>
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
				</div>
			{/each}
		</div>
	{/if}
</div>
