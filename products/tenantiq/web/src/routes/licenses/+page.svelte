<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import TrialGate from '$components/TrialGate.svelte';
	import { tenant } from '$stores/tenant';
	import { auth } from '$stores/auth';
	import { api } from '$api/client';
	import { formatCurrency, formatNumber, formatPercentage } from '$utils/format';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';
	import { getLimit, isTrialOrFree } from '$lib/config/plan-limits';

	interface LicenseSummary {
		skuId: string; skuName: string; total: number;
		assigned: number; costPerUnit: number | null;
	}
	interface WasteItem { skuName: string; unassigned: number; monthlyCost: number; }

	let licenses = $state<LicenseSummary[]>([]);
	let waste = $state<WasteItem[]>([]);
	let loading = $state(true);
	let totalSpend = $state(0);
	let totalWaste = $state(0);

	$effect(() => { if ($tenant.currentTenantId) loadLicenses(); });

	async function loadLicenses() {
		loading = true;
		try {
			const [licData, wasteData] = await Promise.all([
				api.get<{ licenses: LicenseSummary[]; totalSpend: number }>(`/tenants/${$tenant.currentTenantId}/licenses`),
				api.get<{ wasteItems: WasteItem[]; totalMonthlyWaste: number }>(`/tenants/${$tenant.currentTenantId}/licenses/waste`)
			]);
			licenses = licData.licenses; totalSpend = licData.totalSpend;
			waste = wasteData.wasteItems; totalWaste = wasteData.totalMonthlyWaste;
		} catch (err) { console.error('[Licenses]', err); }
		finally { loading = false; }
	}

	function handleExportCsv() {
		exportCsv(licenses, [
			{ key: 'skuName', label: 'License' }, { key: 'total', label: 'Total' },
			{ key: 'assigned', label: 'Assigned' }, { key: 'costPerUnit', label: 'Cost/Unit' },
		], 'licenses');
		toasts.success('Licenses exported as CSV');
	}

	function handleExportJson() {
		exportJson({ licenses, waste, totalSpend, totalWaste }, { type: 'licenses' }, 'licenses');
		toasts.success('Licenses exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied to clipboard');
	}

	async function optimizeAll() {
		if (!$tenant.currentTenantId) return;
		await api.post(`/tenants/${$tenant.currentTenantId}/licenses/optimize`);
		loadLicenses();
	}

	const userPlan = $derived($auth.user?.plan ?? 'trial');
	const licLimit = $derived(getLimit(userPlan, 'licenses'));
	const isGated = $derived(isTrialOrFree(userPlan));
	const previewLicenses = $derived(isGated ? licenses.slice(0, licLimit) : licenses);

	let syncing = $state(false);
	async function triggerSync() {
		if (!$tenant.currentTenantId || syncing) return;
		syncing = true;
		try {
			const res = await api.post<{ users?: number; licenses?: number; workspaces?: number; errors?: string[]; error?: string }>(`/tenants/${$tenant.currentTenantId}/sync`);
			if (res.error) {
				toasts.error(res.error);
			} else {
				toasts.success(`Synced ${res.users ?? 0} users, ${res.licenses ?? 0} licenses, ${res.workspaces ?? 0} workspaces`);
				setTimeout(() => loadLicenses(), 1000);
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Sync failed';
			toasts.error(msg.includes('token') ? 'Please sign out and sign in again to refresh Microsoft 365 access.' : msg);
		} finally { syncing = false; }
	}
</script>

<svelte:head><title>Licenses | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Licenses" description="Microsoft 365 license management and cost analysis" iconPath="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z">
		{#snippet children()}
			<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink} disabled={licenses.length === 0} />
			{#if totalWaste > 0}
				<button onclick={optimizeAll} class="btn-primary">Optimize All</button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#each Array(3) as _}<div class="h-24 animate-pulse panel"></div>{/each}
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<MetricCard title="Total Spend" value={formatCurrency(totalSpend)} subtitle="Monthly license cost" />
			<MetricCard title="License Waste" value={formatCurrency(totalWaste)} subtitle="Unused license cost" />
			<MetricCard title="Total SKUs" value={formatNumber(licenses.length)} subtitle="Active subscriptions" />
		</div>

		{#if licenses.length > 0}
			<div class="panel">
				<table class="table-premium">
					<thead>
						<tr>
							<th class="text-left">License</th>
							<th class="text-right">Total</th>
							<th class="text-right">Assigned</th>
							<th class="text-right">Available</th>
							<th class="text-right">Utilization</th>
							<th class="text-right">Cost/Unit</th>
						</tr>
					</thead>
					<tbody>
						{#each previewLicenses as lic}
							<tr>
								<td class="text-[var(--color-text)]">{lic.skuName}</td>
								<td class="text-right tabular-nums">{formatNumber(lic.total)}</td>
								<td class="text-right tabular-nums">{formatNumber(lic.assigned)}</td>
								<td class="text-right tabular-nums">{formatNumber((lic.total ?? 0) - (lic.assigned ?? 0))}</td>
								<td class="text-right">
									<span class="{lic.total && (lic.assigned / lic.total) < 0.5 ? 'pill-danger' : 'pill-success'}">
										{formatPercentage(lic.assigned, lic.total)}
									</span>
								</td>
								<td class="text-right tabular-nums">{lic.costPerUnit ? formatCurrency(lic.costPerUnit) : '--'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if isGated && licenses.length > licLimit}
				<TrialGate plan={userPlan} feature="license SKUs" previewCount={licLimit} totalCount={licenses.length} requiredPlan="starter">
					{#snippet preview()}{/snippet}
				</TrialGate>
			{/if}
		{:else}
			<div class="empty-state">
				<div class="empty-state-icon">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
				</div>
				<h3>License data awaiting sync</h3>
				<p>Sync your tenant to pull Microsoft 365 subscription data, utilization rates, and cost optimization opportunities.</p>
				<div class="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3">
					{#each [['Subscriptions', 'SKU inventory'], ['Utilization', 'Assigned vs total'], ['Savings', 'Waste detection']] as [title, sub]}
						<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
							<p class="text-xs font-medium text-[var(--color-text)]">{title}</p>
							<p class="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{sub}</p>
						</div>
					{/each}
				</div>
				<div class="mt-6 flex items-center justify-center gap-3">
					<button onclick={triggerSync} disabled={syncing} class="btn-primary">
						{#if syncing}
							<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
							Syncing...
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
							Sync from Microsoft 365
						{/if}
					</button>
					<a href="/ai" class="btn-secondary">AI Optimizer</a>
				</div>
			</div>
		{/if}

		{#if waste.length > 0}
			<div class="panel">
				<div class="panel-header">
					<h2 class="panel-title">Waste Analysis</h2>
				</div>
				<div class="panel-body" style="padding: 0;">
					<div class="space-y-0 divide-y divide-[var(--color-border)]">
						{#each waste as item}
							<div class="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[var(--color-bg-secondary)]">
								<div>
									<p class="text-sm font-medium text-[var(--color-text)]">{item.skuName}</p>
									<p class="text-xs text-[var(--color-text-secondary)]">{item.unassigned} unused licenses</p>
								</div>
								<span class="pill-danger">{formatCurrency(item.monthlyCost)}/mo wasted</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
