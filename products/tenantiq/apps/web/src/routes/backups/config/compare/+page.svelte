<script lang="ts">
	import SnapshotDiff from '$lib/components/snapshots/SnapshotDiff.svelte';
	import CategoryBadge from '$lib/components/snapshots/CategoryBadge.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { page } from '$app/stores';
	import { untrack } from 'svelte';

	interface Snapshot {
		id: string; label: string; snapshot_type: string;
		category_count: number; object_count: number;
		baseline: number; created_by: string; created_at: string;
	}

	let snapshots = $state<Snapshot[]>([]);
	let loading = $state(true);
	let comparing = $state(false);
	let snapshotA = $state<string>('');
	let snapshotB = $state<string>('');
	let diffData = $state<{ diffs: any[]; totalChanges: number } | null>(null);
	let selectedDetail = $state<{ id: string; categories: string[] } | null>(null);
	let exporting = $state(false);

	async function exportDiff() {
		if (!snapshotA || !snapshotB) return;
		exporting = true;
		try {
			const url = `/config-snapshots/${snapshotA}/export?compare=${snapshotB}&format=json`;
			const res = await api.get<any>(url);
			const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = `snapshot-diff-${snapshotA.slice(0, 8)}-${snapshotB.slice(0, 8)}.json`;
			link.click();
			URL.revokeObjectURL(link.href);
			toasts.success('Diff exported as JSON');
		} catch { toasts.error('Export failed'); }
		finally { exporting = false; }
	}

	// Initialize from URL params
	$effect(() => {
		const params = $page.url.searchParams;
		const a = params.get('a');
		const b = params.get('b');
		if (a) snapshotA = a;
		if (b) snapshotB = b;
	});

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadSnapshots()); });

	async function loadSnapshots() {
		loading = true;
		try {
			const res = await api.get<{ snapshots: Snapshot[] }>('/config-snapshots');
			snapshots = res.snapshots;
		} catch { snapshots = []; }
		finally { loading = false; }
	}

	async function runCompare() {
		if (!snapshotA || !snapshotB) { toasts.error('Select two snapshots to compare'); return; }
		if (snapshotA === snapshotB) { toasts.error('Select two different snapshots'); return; }
		comparing = true;
		try {
			diffData = await api.get(`/config-snapshots/${snapshotA}/diff/${snapshotB}`);
		} catch { toasts.error('Comparison failed'); }
		finally { comparing = false; }
	}

	async function viewDetail(id: string) {
		try {
			const res = await api.get<{ snapshot: { categories: string[] } }>(`/config-snapshots/${id}`);
			selectedDetail = { id, categories: res.snapshot.categories };
		} catch { toasts.error('Failed to load snapshot detail'); }
	}

	let labelA = $derived(snapshots.find(s => s.id === snapshotA)?.label ?? 'Snapshot A');
	let labelB = $derived(snapshots.find(s => s.id === snapshotB)?.label ?? 'Snapshot B');
</script>

<svelte:head><title>Compare Snapshots | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div>
		<div class="flex items-center gap-2">
			<a href="/backups/config" class="text-sm text-[var(--color-primary)] hover:underline">&larr; Snapshots</a>
		</div>
		<h1 class="mt-2 text-2xl font-bold text-[var(--color-text)]">Compare Snapshots</h1>
		<p class="text-[var(--color-text-secondary)]">Side-by-side comparison of M365 configuration between two points in time</p>
	</div>

	{#if loading}
		<div class="h-32 skeleton rounded-2xl"></div>
	{:else}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="snap-a" class="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Base Snapshot</label>
					<select id="snap-a" bind:value={snapshotA} class="w-full cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
						<option value="">Select snapshot...</option>
						{#each snapshots as s (s.id)}
							<option value={s.id}>{s.label} {s.baseline ? '(baseline)' : ''}</option>
						{/each}
					</select>
					{#if snapshotA}
						<button onclick={() => viewDetail(snapshotA)} class="mt-1 cursor-pointer text-[11px] text-[var(--color-primary)] hover:underline">View details</button>
					{/if}
				</div>
				<div>
					<label for="snap-b" class="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Compare With</label>
					<select id="snap-b" bind:value={snapshotB} class="w-full cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
						<option value="">Select snapshot...</option>
						{#each snapshots as s (s.id)}
							<option value={s.id}>{s.label} {s.baseline ? '(baseline)' : ''}</option>
						{/each}
					</select>
					{#if snapshotB}
						<button onclick={() => viewDetail(snapshotB)} class="mt-1 cursor-pointer text-[11px] text-[var(--color-primary)] hover:underline">View details</button>
					{/if}
				</div>
			</div>
			<div class="mt-4 flex items-center gap-2">
				<button onclick={runCompare} disabled={comparing || !snapshotA || !snapshotB} class="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50">
					{#if comparing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Comparing...{:else}Compare Snapshots{/if}
				</button>
				{#if diffData}
					<button onclick={exportDiff} disabled={exporting} class="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50">
						{#if exporting}Exporting...{:else}Export JSON{/if}
					</button>
				{/if}
			</div>
		</div>
	{/if}

	{#if selectedDetail}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
			<div class="mb-2 flex items-center justify-between">
				<h3 class="text-xs font-semibold text-[var(--color-text)]">Categories in snapshot</h3>
				<button onclick={() => (selectedDetail = null)} class="cursor-pointer text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Close</button>
			</div>
			<div class="flex flex-wrap gap-1.5">
				{#each selectedDetail.categories as cat}
					<CategoryBadge category={cat} size="md" />
				{/each}
			</div>
		</div>
	{/if}

	{#if diffData}
		<SnapshotDiff diffs={diffData.diffs} totalChanges={diffData.totalChanges} snapshotALabel={labelA} snapshotBLabel={labelB} onClose={() => (diffData = null)} />
	{/if}
</div>
