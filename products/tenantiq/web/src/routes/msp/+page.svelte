<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import MspComparisonTable from '$components/msp/MspComparisonTable.svelte';
	import ClientReportGenerator from '$components/msp/ClientReportGenerator.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { auth } from '$stores/auth';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { goto } from '$app/navigation';
	import { formatCurrency, formatNumber } from '$utils/format';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$utils/safe-error';

	interface TenantSummary {
		id: string; displayName: string; domain: string; status: string;
		lastSyncAt: string | null; userCount: number; licenseUtilization: number;
		monthlySpend: number; monthlyWaste: number; healthScore: number;
		health: 'green' | 'yellow' | 'red';
		alertCounts: { total: number; critical: number; high: number; medium: number; low: number };
	}
	interface Summary {
		totalTenants: number; totalUsers: number; totalSpend: number;
		totalWaste: number; totalAlerts: number; totalCritical: number;
	}

	let tenants = $state<TenantSummary[]>([]);
	let summary = $state<Summary>({ totalTenants: 0, totalUsers: 0, totalSpend: 0, totalWaste: 0, totalAlerts: 0, totalCritical: 0 });
	let loading = $state(true);
	let error = $state('');

	$effect(() => { if ($auth.user) loadOverview(); });

	async function loadOverview() {
		loading = true;
		error = '';
		try {
			const data = await api.get<{ tenants: TenantSummary[]; summary: Summary }>('/msp/overview');
			tenants = data.tenants;
			summary = data.summary;
		} catch (err: any) {
			error = safeErrorMessage(err, 'Failed to load MSP overview');
			console.error('[MSP]', err);
		} finally { loading = false; }
	}

	function selectTenant(id: string) {
		tenant.setCurrentTenant(id);
		goto('/');
	}

	function handleExportCsv() {
		const rows = tenants.map(t => ({
			name: t.displayName, domain: t.domain, users: t.userCount,
			licenseUtil: `${t.licenseUtilization}%`, alerts: t.alertCounts.total,
			critical: t.alertCounts.critical, high: t.alertCounts.high,
			spend: t.monthlySpend, waste: t.monthlyWaste, health: t.healthScore,
			lastSync: t.lastSyncAt ?? 'Never',
		}));
		exportCsv(rows, [
			{ key: 'name', label: 'Tenant' }, { key: 'domain', label: 'Domain' },
			{ key: 'users', label: 'Users' }, { key: 'licenseUtil', label: 'License Util' },
			{ key: 'alerts', label: 'Alerts' }, { key: 'critical', label: 'Critical' },
			{ key: 'high', label: 'High' }, { key: 'spend', label: 'Spend/mo' },
			{ key: 'waste', label: 'Waste/mo' }, { key: 'health', label: 'Health Score' },
			{ key: 'lastSync', label: 'Last Sync' },
		], 'msp-comparison');
		toasts.success('Comparison exported as CSV');
	}

	function handleExportJson() {
		exportJson({ tenants, summary } as any, { type: 'msp-comparison' }, 'msp-comparison');
		toasts.success('Comparison exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied to clipboard');
	}
</script>

<svelte:head><title>MSP Dashboard | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="MSP Dashboard" description="Multi-tenant management overview">
		<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink}
			disabled={tenants.length === 0} label="Export Comparison" />
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each Array(4) as _}<div class="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>{/each}
		</div>
		<div class="h-64 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>
	{:else if error}
		<div class="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-6 text-center">
			<p class="text-sm text-[var(--color-danger)]">{error}</p>
			<button class="btn-primary mt-3" onclick={loadOverview}>Retry</button>
		</div>
	{:else if tenants.length === 0}
		<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
			<p class="text-lg font-medium text-[var(--color-text)]">No tenants connected</p>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Connect Microsoft 365 tenants to see your multi-tenant overview.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<MetricCard title="Managed Tenants" value={formatNumber(summary.totalTenants)} subtitle="{tenants.filter(t => t.health === 'red').length} need attention" />
			<MetricCard title="Total Users" value={formatNumber(summary.totalUsers)} subtitle="Across all tenants" />
			<MetricCard title="Monthly Spend" value={formatCurrency(summary.totalSpend)} subtitle="{formatCurrency(summary.totalWaste)} waste" />
			<MetricCard title="Active Alerts" value={formatNumber(summary.totalAlerts)} subtitle="{summary.totalCritical} critical" href="/alerts" />
		</div>

		<div>
			<h2 class="mb-3 section-title">Tenant Comparison</h2>
			<MspComparisonTable {tenants} onSelect={selectTenant} />
		</div>

		<ClientReportGenerator tenants={tenants.map(t => ({ id: t.id, displayName: t.displayName }))} />

		<a href="/msp/profit" class="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:underline">
			View Profit Dashboard &rarr;
		</a>
	{/if}
</div>
