<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import WorkspaceTable from '$lib/components/governance/WorkspaceTable.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { formatNumber } from '$utils/format';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { untrack } from 'svelte';

	interface Summary { total: number; teams: number; withGuests: number; noOwner: number; totalStorageBytes: number }
	let workspaces = $state<any[]>([]);
	let summary = $state<Summary>({ total: 0, teams: 0, withGuests: 0, noOwner: 0, totalStorageBytes: 0 });
	let loading = $state(true);
	let syncing = $state(false);
	let filterType = $state('all');
	let filterRisk = $state('all');

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadWorkspaces()); });

	async function loadWorkspaces() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (filterType !== 'all') params.set('type', filterType);
			if (filterRisk !== 'all') params.set('filter', filterRisk);
			const res = await api.get<{ workspaces: any[]; summary: Summary }>(`/governance/workspaces?${params}`);
			workspaces = res.workspaces;
			summary = res.summary;
		} catch { workspaces = []; }
		finally { loading = false; }
	}

	async function syncWorkspaces() {
		syncing = true;
		try {
			const res = await api.post<{ workspaces?: number; errors?: string[]; error?: string }>('/governance/sync');
			if (res.error) { toasts.error(res.error); }
			else { toasts.success(`Synced ${res.workspaces ?? 0} workspaces`); loadWorkspaces(); }
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Sync failed');
		} finally { syncing = false; }
	}

	function handleExportCsv() {
		exportCsv(workspaces, [
			{ key: 'display_name', label: 'Name' }, { key: 'workspace_type', label: 'Type' },
			{ key: 'member_count', label: 'Members' }, { key: 'guest_count', label: 'Guests' },
			{ key: 'owner_count', label: 'Owners' }, { key: 'visibility', label: 'Visibility' },
			{ key: 'external_sharing', label: 'Sharing' },
		], 'workspaces');
		toasts.success('Exported');
	}

	function handleExportJson() { exportJson(workspaces, { type: 'governance' }, 'workspaces'); toasts.success('Exported'); }
	async function handleCopyLink() { if (await copyToClipboard(window.location.href)) toasts.success('Copied'); }

	const storageGB = $derived((summary.totalStorageBytes / (1024 * 1024 * 1024)).toFixed(1));
</script>

<svelte:head><title>Governance | TenantIQ</title></svelte:head>

<div class="page-container" style="display:flex;flex-direction:column;gap:24px;">
	<PageHeader title="Workspaces" description="Microsoft 365 workspace governance" iconPath="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z">
		<div style="display:flex;align-items:center;gap:8px;">
			{#if workspaces.length > 0}<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink} />{/if}
			<button onclick={syncWorkspaces} disabled={syncing} class="btn-primary">
				{#if syncing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Syncing...{:else}Sync Workspaces{/if}
			</button>
		</div>
	</PageHeader>

	{#if loading}
		<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;">
			{#each Array(5) as _, i}<div class="skeleton" style="height:112px;border-radius:var(--radius-xl);"></div>{/each}
		</div>
	{:else if summary.total === 0}
		<div class="panel">
			<div class="panel-body">
				<div class="empty-state">
					<div class="empty-state-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
					</div>
					<h3>Workspace Governance</h3>
					<p>Sync your Microsoft 365 Groups, Teams, and SharePoint sites to monitor membership, guest access, orphaned workspaces, and storage usage.</p>
					<button onclick={syncWorkspaces} disabled={syncing} class="btn-primary" style="margin-top:24px;">
						{#if syncing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Syncing...{:else}Sync Workspaces{/if}
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- Metric cards -->
		<div class="animate-fade-up" style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;">
			<MetricCard title="Total Workspaces" value={formatNumber(summary.total)} subtitle="{summary.teams} Teams" />
			<MetricCard title="With Guests" value={formatNumber(summary.withGuests)} subtitle="External access" />
			<MetricCard title="No Owner" value={formatNumber(summary.noOwner)} subtitle="Orphaned workspaces" />
			<MetricCard title="Groups" value={formatNumber(summary.total - summary.teams)} subtitle="Non-Teams groups" />
			<MetricCard title="Storage" value="{storageGB} GB" subtitle="Total used" />
		</div>

		<!-- Filters -->
		<div class="filter-bar">
			<select bind:value={filterType} onchange={loadWorkspaces} class="select-premium">
				<option value="all">All types</option>
				<option value="team">Teams</option>
				<option value="group">Groups</option>
			</select>
			<select bind:value={filterRisk} onchange={loadWorkspaces} class="select-premium">
				<option value="all">All</option>
				<option value="external">External sharing</option>
				<option value="no_owner">No owner</option>
				<option value="inactive">Inactive</option>
			</select>
		</div>

		<div class="animate-fade-up">
			<WorkspaceTable {workspaces} />
		</div>
	{/if}
</div>
