<script lang="ts">
	/**
	 * DiffViewer — side-by-side JSON diff with add/remove/change highlighting.
	 * Accepts before/after objects, flattens keys, and shows changes.
	 */

	interface Props {
		before: Record<string, unknown>;
		after: Record<string, unknown>;
		title?: string;
	}

	type DiffEntry = {
		key: string;
		type: 'added' | 'removed' | 'changed' | 'unchanged';
		oldValue?: string;
		newValue?: string;
	};

	let { before, after, title = 'Configuration Diff' }: Props = $props();

	function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
		const result: Record<string, string> = {};
		for (const [k, v] of Object.entries(obj)) {
			const path = prefix ? `${prefix}.${k}` : k;
			if (v && typeof v === 'object' && !Array.isArray(v)) {
				Object.assign(result, flatten(v as Record<string, unknown>, path));
			} else {
				result[path] = JSON.stringify(v);
			}
		}
		return result;
	}

	const entries = $derived.by(() => {
		const flatBefore = flatten(before);
		const flatAfter = flatten(after);
		const allKeys = [...new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)])].sort();

		const diffs: DiffEntry[] = [];
		for (const key of allKeys) {
			const old = flatBefore[key];
			const cur = flatAfter[key];
			if (old === undefined) {
				diffs.push({ key, type: 'added', newValue: cur });
			} else if (cur === undefined) {
				diffs.push({ key, type: 'removed', oldValue: old });
			} else if (old !== cur) {
				diffs.push({ key, type: 'changed', oldValue: old, newValue: cur });
			} else {
				diffs.push({ key, type: 'unchanged', oldValue: old, newValue: cur });
			}
		}
		return diffs;
	});

	const changeCount = $derived(entries.filter((e) => e.type !== 'unchanged').length);
</script>

<div class="diff-viewer">
	<div class="diff-header">
		<h3 class="diff-title">{title}</h3>
		<span class="diff-badge">{changeCount} change{changeCount !== 1 ? 's' : ''}</span>
	</div>

	{#if entries.length === 0}
		<p class="diff-empty">No properties to compare.</p>
	{:else}
		<div class="diff-table" role="table" aria-label="Configuration differences">
			<div class="diff-row diff-row-head" role="row">
				<span class="diff-cell diff-key" role="columnheader">Property</span>
				<span class="diff-cell" role="columnheader">Before</span>
				<span class="diff-cell" role="columnheader">After</span>
			</div>
			{#each entries as entry (entry.key)}
				<div class="diff-row diff-row-{entry.type}" role="row" aria-label="{entry.type}">
					<span class="diff-cell diff-key" role="cell">{entry.key}</span>
					<span class="diff-cell diff-old" role="cell">
						{#if entry.type === 'added'}
							<span class="diff-placeholder">--</span>
						{:else}
							{entry.oldValue}
						{/if}
					</span>
					<span class="diff-cell diff-new" role="cell">
						{#if entry.type === 'removed'}
							<span class="diff-placeholder">--</span>
						{:else}
							{entry.newValue}
						{/if}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.diff-viewer {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
		background: var(--color-surface);
		font-size: 0.8125rem;
	}
	.diff-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
	}
	.diff-title { font-weight: 600; color: var(--color-text); margin: 0; font-size: 0.875rem; }
	.diff-badge {
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		background: var(--color-primary);
		color: white;
	}
	.diff-empty { padding: 2rem; text-align: center; color: var(--color-text-secondary); }
	.diff-table { display: grid; grid-template-columns: minmax(180px, 1fr) 1fr 1fr; }
	.diff-row { display: contents; }
	.diff-row-head .diff-cell {
		font-weight: 600;
		background: var(--color-bg-secondary);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		text-transform: uppercase;
		font-size: 0.6875rem;
		letter-spacing: 0.05em;
	}
	.diff-cell {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
		word-break: break-all;
		color: var(--color-text);
	}
	.diff-key { font-family: var(--font-mono, monospace); color: var(--color-text-secondary); }
	.diff-row-added .diff-new { background: rgba(34, 197, 94, 0.1); color: #16a34a; }
	.diff-row-removed .diff-old { background: rgba(239, 68, 68, 0.1); color: #dc2626; }
	.diff-row-changed .diff-old { background: rgba(239, 68, 68, 0.08); }
	.diff-row-changed .diff-new { background: rgba(34, 197, 94, 0.08); }
	.diff-placeholder { opacity: 0.3; }

	:global(.dark) .diff-row-added .diff-new { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
	:global(.dark) .diff-row-removed .diff-old { background: rgba(239, 68, 68, 0.15); color: #f87171; }
	:global(.dark) .diff-row-changed .diff-old { background: rgba(239, 68, 68, 0.1); }
	:global(.dark) .diff-row-changed .diff-new { background: rgba(34, 197, 94, 0.1); }
</style>
