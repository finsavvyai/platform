<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { formatNumber } from '$utils/format';
	import { untrack } from 'svelte';

	interface SiteInfo {
		id: string;
		displayName: string;
		webUrl: string;
		lastActivityDate: string | null;
		owner: string | null;
		ownerEmail: string | null;
		storageUsedBytes: number;
		storageAllocatedBytes: number;
		status: 'active' | 'expiring' | 'archived';
	}

	let sites = $state<SiteInfo[]>([]);
	let expiring = $state<SiteInfo[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let statusFilter = $state('all');

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadSites()); });

	async function loadSites() {
		loading = true;
		try {
			const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
			const res = await api.get<{ data: SiteInfo[]; expiring: SiteInfo[]; total: number }>(`/governance/sites${params}`);
			sites = res.data ?? [];
			expiring = res.expiring ?? [];
			total = res.total ?? 0;
		} catch { sites = []; expiring = []; }
		finally { loading = false; }
	}

	async function archiveSite(site: SiteInfo) {
		try {
			await api.post(`/governance/sites/${site.id}/archive`);
			toasts.success(`Archived ${site.displayName}`);
			loadSites();
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Archive failed'); }
	}

	async function renewSite(site: SiteInfo) {
		try {
			await api.post(`/governance/sites/${site.id}/renew`);
			toasts.success(`Renewed ${site.displayName}`);
			loadSites();
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Renewal failed'); }
	}

	function formatStorage(bytes: number): string {
		if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
		if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
		return `${(bytes / 1024).toFixed(0)} KB`;
	}

	function daysSince(dateStr: string | null): string {
		if (!dateStr) return 'Unknown';
		const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
		if (days === 0) return 'Today';
		if (days === 1) return '1 day ago';
		return `${days} days ago`;
	}

	const statusColor: Record<string, string> = {
		active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
		expiring: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
		archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
	};
</script>

<svelte:head><title>Site Lifecycle | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div class="animate-fade-up flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-text)]">SharePoint Site Lifecycle</h1>
			<p class="text-[var(--color-text-secondary)]">Monitor site activity, archive stale sites, and manage renewals</p>
		</div>
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#each Array(3) as _, i}<div class="h-28 skeleton rounded-2xl delay-{i + 1}"></div>{/each}
		</div>
	{:else}
		<div class="animate-fade-up delay-1 grid grid-cols-1 gap-4 sm:grid-cols-3">
			<MetricCard title="Total Sites" value={formatNumber(total)} subtitle="SharePoint sites" />
			<MetricCard title="Expiring" value={formatNumber(expiring.length)} subtitle="Inactive > 90 days" />
			<MetricCard title="Active" value={formatNumber(total - expiring.length)} subtitle="Recently used" />
		</div>

		<!-- Filter -->
		<div class="flex gap-3">
			<select bind:value={statusFilter} onchange={loadSites} class="min-h-[44px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]">
				<option value="all">All sites</option>
				<option value="expiring">Expiring</option>
				<option value="archived">Archived</option>
			</select>
		</div>

		<!-- Table -->
		{#if sites.length === 0}
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
				<h2 class="text-xl font-semibold text-[var(--color-text)]">No Sites Found</h2>
				<p class="mt-2 text-sm text-[var(--color-text-secondary)]">Connect a tenant and sync to see SharePoint sites.</p>
			</div>
		{:else}
			<div class="animate-fade-up delay-2 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-secondary)]">
						<tr>
							<th class="px-4 py-3">Site Name</th>
							<th class="px-4 py-3">Owner</th>
							<th class="px-4 py-3">Last Activity</th>
							<th class="px-4 py-3">Storage</th>
							<th class="px-4 py-3">Status</th>
							<th class="px-4 py-3">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each sites as site (site.id)}
							<tr class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]">
								<td class="px-4 py-3">
									<a href={site.webUrl} target="_blank" rel="noopener noreferrer" class="font-medium text-[var(--color-primary)] hover:underline">{site.displayName}</a>
								</td>
								<td class="px-4 py-3 text-[var(--color-text-secondary)]">{site.owner ?? 'No owner'}</td>
								<td class="px-4 py-3 text-[var(--color-text-secondary)]">{daysSince(site.lastActivityDate)}</td>
								<td class="px-4 py-3 text-[var(--color-text-secondary)]">{formatStorage(site.storageUsedBytes)}</td>
								<td class="px-4 py-3">
									<span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor[site.status] ?? statusColor.active}">{site.status}</span>
								</td>
								<td class="px-4 py-3">
									<div class="flex gap-2">
										{#if site.status !== 'archived'}
											<button onclick={() => archiveSite(site)} class="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]">Archive</button>
										{/if}
										{#if site.status === 'expiring'}
											<button onclick={() => renewSite(site)} class="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white transition-all hover:shadow-sm">Renew</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
