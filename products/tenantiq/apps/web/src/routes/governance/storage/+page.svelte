<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import StorageOverview from '$components/storage/StorageOverview.svelte';
	import ConsumersTable from '$components/storage/ConsumersTable.svelte';
	import StorageRecommendations from '$components/storage/StorageRecommendations.svelte';
	import UnusedLicenses from '$components/storage/UnusedLicenses.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { untrack } from 'svelte';

	interface StorageOverviewData { totalUsedGB: number; totalAllocatedGB: number; utilizationPct: number; oneDriveUsedGB: number; oneDriveAllocatedGB: number; sharePointUsedGB: number; sharePointAllocatedGB: number; userCount: number; siteCount: number; scannedAt: string }
	interface ODUser { userId: string; displayName: string; email: string; usedGB: number; allocatedGB: number; utilizationPct: number }
	interface SPSite { siteId: string; name: string; url: string; usedGB: number; allocatedGB: number; utilizationPct: number }
	interface Rec { id: string; type: string; severity: 'low' | 'medium' | 'high'; title: string; description: string; potentialSavingsGB: number; affectedItems: number }
	interface ULicense { userId: string; displayName: string; email: string; licenseName: string; allocatedGB: number; usedGB: number; utilizationPct: number; lastActivityDate: string | null; monthlyInactive: boolean }

	let loading = $state(true);
	let scanning = $state(false);
	let tab = $state<'overview' | 'onedrive' | 'sharepoint' | 'licenses'>('overview');

	let overview = $state<StorageOverviewData | null>(null);
	let oneDriveUsers = $state<ODUser[]>([]);
	let sharePointSites = $state<SPSite[]>([]);
	let recommendations = $state<Rec[]>([]);
	let unusedLicenses = $state<ULicense[]>([]);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadData()); });

	async function loadData() {
		loading = true;
		try {
			const res = await api.get<{ overview: StorageOverviewData | null; oneDriveUsers: ODUser[]; sharePointSites: SPSite[]; recommendations: Rec[]; unusedLicenses: ULicense[] }>('/storage-analytics');
			overview = res.overview;
			oneDriveUsers = res.oneDriveUsers ?? [];
			sharePointSites = res.sharePointSites ?? [];
			recommendations = res.recommendations ?? [];
			unusedLicenses = res.unusedLicenses ?? [];
		} catch { overview = null; }
		finally { loading = false; }
	}

	async function scanStorage() {
		scanning = true;
		try {
			const res = await api.post<{ error?: string; overview: StorageOverviewData; oneDriveUsers: ODUser[]; sharePointSites: SPSite[]; recommendations: Rec[]; unusedLicenses: ULicense[] }>('/storage-analytics/scan');
			if (res.error) { toasts.error(res.error); return; }
			overview = res.overview;
			oneDriveUsers = res.oneDriveUsers ?? [];
			sharePointSites = res.sharePointSites ?? [];
			recommendations = res.recommendations ?? [];
			unusedLicenses = res.unusedLicenses ?? [];
			toasts.success(`Scanned ${oneDriveUsers.length} users and ${sharePointSites.length} sites`);
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Scan failed'); }
		finally { scanning = false; }
	}

	const tabs = [
		{ key: 'overview', label: 'Overview' },
		{ key: 'onedrive', label: 'OneDrive' },
		{ key: 'sharepoint', label: 'SharePoint' },
		{ key: 'licenses', label: 'Unused Licenses' },
	] as const;

	const odConsumers = $derived(oneDriveUsers.map((u) => ({
		id: u.userId, name: u.displayName, email: u.email,
		usedGB: u.usedGB, allocatedGB: u.allocatedGB, utilizationPct: u.utilizationPct,
	})));

	const spConsumers = $derived(sharePointSites.map((s) => ({
		id: s.siteId, name: s.name, url: s.url,
		usedGB: s.usedGB, allocatedGB: s.allocatedGB, utilizationPct: s.utilizationPct,
	})));
</script>

<svelte:head><title>Storage Analytics | TenantIQ</title></svelte:head>

<div class="page-container" style="display:flex;flex-direction:column;gap:24px;">
	<PageHeader title="Storage Analytics" description="OneDrive and SharePoint storage analysis" iconPath="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125">
		<button onclick={scanStorage} disabled={scanning} class="btn-primary">
			{#if scanning}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Scanning...{:else}Scan Storage{/if}
		</button>
	</PageHeader>

	<!-- Tab navigation -->
	<div class="filter-bar" style="width:fit-content;padding:3px;border-radius:var(--radius-lg);background:var(--color-bg);">
		{#each tabs as t (t.key)}
			<button
				role="tab"
				aria-selected={tab === t.key}
				onclick={() => tab = t.key}
				class="{tab === t.key ? 'btn-primary' : 'btn-secondary'}"
				style="padding:6px 16px;font-size:13px;min-height:auto;"
			>
				{t.label}
				{#if t.key === 'licenses' && unusedLicenses.length > 0}
					<span class="pill-danger" style="font-size:10px;margin-left:6px;padding:1px 6px;">{unusedLicenses.length}</span>
				{/if}
			</button>
		{/each}
	</div>

	{#if loading}
		<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
			{#each Array(4) as _}<div class="skeleton" style="height:112px;border-radius:var(--radius-xl);"></div>{/each}
		</div>
	{:else if !overview}
		<div class="panel">
			<div class="panel-body">
				<div class="empty-state">
					<div class="empty-state-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/></svg>
					</div>
					<h3>Analyze Storage Usage</h3>
					<p>Scan your tenant to see OneDrive and SharePoint storage usage, identify top consumers, detect unused licenses, and get optimization recommendations.</p>
					<button onclick={scanStorage} disabled={scanning} class="btn-primary" style="margin-top:24px;">
						{#if scanning}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Scanning...{:else}Scan Storage{/if}
					</button>
				</div>
			</div>
		</div>
	{:else}
		{#if tab === 'overview'}
			<StorageOverview {overview} />
			<StorageRecommendations {recommendations} />
		{:else if tab === 'onedrive'}
			<ConsumersTable title="OneDrive — Per-User Storage" consumers={odConsumers} type="user" />
		{:else if tab === 'sharepoint'}
			<ConsumersTable title="SharePoint — Per-Site Storage" consumers={spConsumers} type="site" />
		{:else if tab === 'licenses'}
			<UnusedLicenses licenses={unusedLicenses} />
		{/if}
	{/if}
</div>
