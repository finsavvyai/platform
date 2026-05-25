<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import { formatRelativeTime } from '$utils/format';
	import { untrack } from 'svelte';

	interface Group {
		id: string; displayName: string; mail: string | null;
		groupType: string; lastActivity: string | null; daysSinceActivity: number | null;
	}
	interface CleanupResult { tenantId: string; runAt: string; total: number; groups: Group[] }

	let results = $state<CleanupResult | null>(null);
	let loading = $state(true);
	let scanning = $state(false);
	let selected = $state<Set<string>>(new Set());
	let archiving = $state(false);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadResults()); });

	async function loadResults() {
		loading = true;
		try {
			const data = await api.get<{ results: CleanupResult | null }>('/group-cleanup/results');
			results = data.results;
		} catch { results = null; }
		finally { loading = false; }
	}

	async function runScan() {
		scanning = true;
		try {
			const data = await api.post<CleanupResult>('/group-cleanup/run');
			results = data;
			toasts.success(`Scan complete: ${data.total} groups found`);
		} catch (err) { toasts.error(safeErrorMessage(err, 'Scan failed')); }
		finally { scanning = false; }
	}

	async function archiveSelected() {
		if (selected.size === 0) return;
		archiving = true;
		try {
			const data = await api.post<{ archived: number; errors: string[] }>('/group-cleanup/archive', { groupIds: [...selected] });
			toasts.success(`${data.archived} group(s) archived`);
			if (data.errors?.length) toasts.error(`${data.errors.length} error(s) occurred`);
			selected = new Set();
		} catch { toasts.error('Archive failed'); }
		finally { archiving = false; }
	}

	function toggleSelect(id: string) {
		const next = new Set(selected);
		next.has(id) ? next.delete(id) : next.add(id);
		selected = next;
	}

	function toggleAll() {
		if (!results) return;
		selected = selected.size === results.groups.length ? new Set() : new Set(results.groups.map(g => g.id));
	}

	const typeLabel: Record<string, string> = { microsoft365: 'M365', security: 'Security' };

	function getActivityStatus(days: number | null): { label: string; cls: string } {
		if (days === null) return { label: 'Unknown', cls: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]' };
		if (days >= 180) return { label: 'Inactive', cls: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]' };
		if (days >= 90) return { label: 'Stale', cls: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]' };
		return { label: 'Active', cls: 'bg-[var(--color-success)]/15 text-[var(--color-success)]' };
	}
</script>

<svelte:head><title>Group Cleanup | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-text)]">Group Cleanup</h1>
			<p class="text-[var(--color-text-secondary)]">Find empty, orphaned, or inactive groups</p>
		</div>
		<button onclick={runScan} disabled={scanning} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white hover:shadow-[var(--shadow-md)] disabled:opacity-50">
			{scanning ? 'Scanning...' : 'Run Scan'}
		</button>
	</div>

	{#if loading}
		<div class="space-y-3">{#each Array(3) as _}<div class="h-14 skeleton rounded-xl"></div>{/each}</div>
	{:else if !results}
		<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center">
			<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
			</div>
			<h3 class="text-base font-semibold text-[var(--color-text)]">No cleanup results yet</h3>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Scan your groups to find cleanup opportunities.</p>
		</div>
	{:else}
		{#if selected.size > 0}
			<div class="flex items-center gap-3">
				<span class="text-sm text-[var(--color-text-secondary)]">{selected.size} selected</span>
				<button onclick={archiveSelected} disabled={archiving} class="rounded-lg bg-[var(--color-warning)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
					{archiving ? 'Archiving...' : 'Archive Selected'}
				</button>
			</div>
		{/if}

		<div class="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
						<th class="p-3"><input type="checkbox" onchange={toggleAll} class="rounded" /></th>
						<th class="p-3">Group</th>
						<th class="p-3">Type</th>
						<th class="p-3">Status</th>
						<th class="p-3">Last Activity</th>
						<th class="p-3">Days Inactive</th>
					</tr>
				</thead>
				<tbody>
					{#each results.groups as group (group.id)}
						{@const activity = getActivityStatus(group.daysSinceActivity)}
						<tr class="border-b border-[var(--color-border)] last:border-0">
							<td class="p-3"><input type="checkbox" checked={selected.has(group.id)} onchange={() => toggleSelect(group.id)} class="rounded" /></td>
							<td class="p-3">
								<p class="font-medium text-[var(--color-text)]">{group.displayName}</p>
								{#if group.mail}<p class="text-xs text-[var(--color-text-secondary)]">{group.mail}</p>{/if}
							</td>
							<td class="p-3"><span class="rounded-full bg-[var(--color-bg-tertiary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">{typeLabel[group.groupType] ?? group.groupType}</span></td>
							<td class="p-3"><span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium {activity.cls}">{activity.label}</span></td>
							<td class="p-3 text-[var(--color-text-secondary)]">{group.lastActivity ? formatRelativeTime(group.lastActivity) : 'Unknown'}</td>
							<td class="p-3 text-[var(--color-text-secondary)]">{group.daysSinceActivity ?? 'N/A'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
