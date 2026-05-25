<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { auth } from '$stores/auth';
	import { api } from '$api/client';
	import { formatNumber } from '$utils/format';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';

	interface TenantMetric {
		id: string; name: string; domain: string; status: string;
		totalUsers: number; activeUsers: number; activeRate: number;
		licenseUtilization: number; activeAlerts: number; cisScore: number | null;
	}
	interface Benchmarks { avgActiveRate: number; avgLicenseUtil: number; avgCisScore: number | null; totalAlerts: number; totalUsers: number }

	let tenants = $state<TenantMetric[]>([]);
	let benchmarks = $state<Benchmarks>({ avgActiveRate: 0, avgLicenseUtil: 0, avgCisScore: null, totalAlerts: 0, totalUsers: 0 });
	let loading = $state(true);
	let sortBy = $state<'activeRate' | 'cisScore' | 'activeAlerts'>('activeRate');

	$effect(() => { if ($auth.user) loadBenchmarks(); });

	async function loadBenchmarks() {
		loading = true;
		try {
			const res = await api.get<{ tenants: TenantMetric[]; benchmarks: Benchmarks }>('/msp-benchmark');
			tenants = res.tenants; benchmarks = res.benchmarks;
		} catch { tenants = []; }
		finally { loading = false; }
	}

	const sorted = $derived([...tenants].sort((a, b) => {
		if (sortBy === 'cisScore') return (b.cisScore ?? 0) - (a.cisScore ?? 0);
		if (sortBy === 'activeAlerts') return b.activeAlerts - a.activeAlerts;
		return b.activeRate - a.activeRate;
	}));

	function handleExportCsv() { exportCsv(tenants, [{ key: 'name', label: 'Tenant' }, { key: 'totalUsers', label: 'Users' }, { key: 'activeRate', label: 'Active %' }, { key: 'licenseUtilization', label: 'License %' }, { key: 'activeAlerts', label: 'Alerts' }, { key: 'cisScore', label: 'CIS Score' }], 'msp-benchmark'); toasts.success('Exported'); }
	function handleExportJson() { exportJson({ tenants, benchmarks }, { type: 'msp-benchmark' }, 'msp-benchmark'); toasts.success('Exported'); }
	async function handleCopyLink() { if (await copyToClipboard(window.location.href)) toasts.success('Copied'); }

	function barColor(val: number, max = 100): string { return val >= max * 0.8 ? 'var(--color-success)' : val >= max * 0.5 ? 'var(--color-warning)' : 'var(--color-danger)'; }
</script>

<svelte:head><title>Tenant Benchmark | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="MSP Benchmark" description="Compare security and efficiency metrics across all managed tenants">
		{#if tenants.length > 0}<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink} />{/if}
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">{#each Array(4) as _, i}<div class="h-28 skeleton rounded-2xl delay-{i + 1}"></div>{/each}</div>
	{:else if tenants.length === 0}
		<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center">
			<h2 class="text-lg font-semibold text-[var(--color-text)]">No tenants to compare</h2>
			<p class="mt-2 text-sm text-[var(--color-text-secondary)]">Connect and sync multiple tenants to see cross-tenant benchmarks.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			<MetricCard title="Total Users" value={formatNumber(benchmarks.totalUsers)} subtitle="Across all tenants" />
			<MetricCard title="Avg Active Rate" value="{benchmarks.avgActiveRate}%" subtitle="User engagement" progress={benchmarks.avgActiveRate} progressColor={barColor(benchmarks.avgActiveRate)} />
			<MetricCard title="Avg License Util" value="{benchmarks.avgLicenseUtil}%" subtitle="License efficiency" progress={benchmarks.avgLicenseUtil} progressColor={barColor(benchmarks.avgLicenseUtil)} />
			<MetricCard title="Total Alerts" value={formatNumber(benchmarks.totalAlerts)} subtitle="{tenants.length} tenants" />
		</div>

		<div class="filter-bar">
			<select bind:value={sortBy} class="select-premium">
				<option value="activeRate">Sort by Active Rate</option>
				<option value="cisScore">Sort by CIS Score</option>
				<option value="activeAlerts">Sort by Alerts</option>
			</select>
		</div>

		<div class="overflow-hidden rounded-2xl border border-[var(--color-border)]">
			<table class="table-premium w-full">
				<thead class="bg-[var(--color-bg)]">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Tenant</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Users</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Active %</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">License %</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">CIS Score</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Alerts</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
					{#each sorted as t (t.id)}
						<tr class="transition-colors hover:bg-[var(--color-bg-secondary)]">
							<td class="px-4 py-3"><p class="text-sm font-medium text-[var(--color-text)]">{t.name}</p><p class="text-[11px] text-[var(--color-text-secondary)]">{t.domain}</p></td>
							<td class="px-4 py-3 text-right text-sm text-[var(--color-text)]">{formatNumber(t.totalUsers)}</td>
							<td class="px-4 py-3 text-right text-sm" style="color: {barColor(t.activeRate)}">{t.activeRate}%</td>
							<td class="px-4 py-3 text-right text-sm" style="color: {barColor(t.licenseUtilization)}">{t.licenseUtilization}%</td>
							<td class="px-4 py-3 text-right text-sm" style="color: {t.cisScore != null ? barColor(t.cisScore) : 'var(--color-text-secondary)'}">{t.cisScore != null ? `${t.cisScore}%` : '--'}</td>
							<td class="px-4 py-3 text-right text-sm {t.activeAlerts > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}">{t.activeAlerts}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
