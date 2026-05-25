<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import UserRiskRow from '$components/UserRiskRow.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';
	import { untrack } from 'svelte';

	interface Anomaly { type: string; detail: string; timestamp: string; severity: string }
	interface UebaUser {
		name: string; email: string; role: string;
		riskScore: number; riskChange: number; riskLevel: string;
		anomalies: Anomaly[];
		baseline: { avgLoginTime: string; avgLocation: string; avgDataAccess: string };
		recentActivity: { logins: number; dataAccess: string; resourcesAccessed: number; failedLogins: number };
	}
	interface UebaSummary {
		totalMonitored: number; criticalRisk: number; highRisk: number;
		mediumRisk: number; lowRisk: number; totalAnomalies: number; avgRiskScore: number;
	}
	interface UebaResponse { users: UebaUser[]; summary: UebaSummary }

	let users = $state<UebaUser[]>([]);
	let summary = $state<UebaSummary>({
		totalMonitored: 0, criticalRisk: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0, totalAnomalies: 0, avgRiskScore: 0,
	});
	let loading = $state(true);
	let refreshing = $state(false);
	let sortBy = $state<'riskScore' | 'anomalies'>('riskScore');
	let filterRisk = $state<string>('all');
	let searchQuery = $state('');

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadUeba()); });

	async function refresh() {
		refreshing = true;
		await loadUeba();
		refreshing = false;
		toasts.success('Behavior data refreshed');
	}

	async function loadUeba() {
		loading = true;
		try {
			const data = await api.get<UebaResponse>(`/tenants/${$tenant.currentTenantId}/ueba`);
			users = data.users;
			summary = data.summary;
		} catch (err) { console.error('[UEBA] load', err); }
		finally { loading = false; }
	}

	function handleExportCsv() {
		const rows = users.map(u => ({ name: u.name, email: u.email, role: u.role, riskScore: u.riskScore, riskLevel: u.riskLevel, anomalies: u.anomalies.length, logins: u.recentActivity.logins, failedLogins: u.recentActivity.failedLogins }));
		exportCsv(rows, [
			{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
			{ key: 'role', label: 'Role' }, { key: 'riskScore', label: 'Risk Score' },
			{ key: 'riskLevel', label: 'Risk Level' }, { key: 'anomalies', label: 'Anomalies' },
			{ key: 'logins', label: 'Logins' }, { key: 'failedLogins', label: 'Failed Logins' },
		], 'user-behavior');
		toasts.success('User behavior data exported as CSV');
	}

	function handleExportJson() {
		exportJson(users, { type: 'user-behavior-analytics' }, 'user-behavior');
		toasts.success('User behavior data exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied to clipboard');
	}

	const filtered = $derived(
		users.filter(u => {
			if (filterRisk !== 'all' && u.riskLevel !== filterRisk) return false;
			if (searchQuery && !u.name.toLowerCase().includes(searchQuery.toLowerCase()) && !u.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
			return true;
		})
	);

	const sorted = $derived(
		[...filtered].sort((a, b) =>
			sortBy === 'anomalies'
				? b.anomalies.length - a.anomalies.length
				: b.riskScore - a.riskScore
		)
	);
</script>

<svelte:head><title>User Behavior Analytics | TenantIQ</title></svelte:head>

<div class="page-container" style="display:flex;flex-direction:column;gap:24px;">
	<PageHeader title="Behavior Analysis" description="User behavior analytics and anomaly detection" iconPath="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5">
		<div style="display:flex;align-items:center;gap:8px;">
			{#if users.length > 0}
				<button onclick={refresh} disabled={refreshing} class="btn-primary">
					{#if refreshing}<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>{/if}
					Refresh
				</button>
			{/if}
			<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink} disabled={users.length === 0} />
		</div>
	</PageHeader>

	<!-- Summary cards -->
	<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
		<MetricCard title="Users Monitored" value={String(summary.totalMonitored)} />
		<MetricCard title="Anomalies (24h)" value={String(summary.totalAnomalies)} progressColor="var(--color-warning)" progress={summary.totalAnomalies ? Math.min(summary.totalAnomalies * 10, 100) : 0} />
		<MetricCard title="Avg Risk Score" value={String(summary.avgRiskScore)} progress={summary.avgRiskScore} progressColor={summary.avgRiskScore >= 50 ? 'var(--color-warning)' : 'var(--color-success)'} />
		<MetricCard title="High Risk Users" value={String(summary.criticalRisk + summary.highRisk)} subtitle={`${summary.criticalRisk} critical, ${summary.highRisk} high`} />
	</div>

	<!-- Filters -->
	<div class="filter-bar">
		<select bind:value={filterRisk} class="select-premium">
			<option value="all">All risk levels</option>
			<option value="critical">Critical</option>
			<option value="high">High</option>
			<option value="medium">Medium</option>
			<option value="low">Low</option>
		</select>
		<select bind:value={sortBy} class="select-premium">
			<option value="riskScore">Sort by Risk Score</option>
			<option value="anomalies">Sort by Anomaly Count</option>
		</select>
		<input bind:value={searchQuery} placeholder="Search users..." class="select-premium" style="min-width:200px;" />
		{#if filterRisk !== 'all' || searchQuery}
			<button onclick={() => { filterRisk = 'all'; searchQuery = ''; }} style="font-size:12px;color:var(--color-primary);background:none;border:none;cursor:pointer;">Clear filters</button>
		{/if}
		<span class="micro-label" style="margin-left:auto;"><span class="tabular-nums">{sorted.length}</span> of <span class="tabular-nums">{users.length}</span> users</span>
	</div>

	<!-- User list -->
	{#if loading}
		<div style="display:flex;flex-direction:column;gap:12px;">
			{#each Array(4) as _}
				<div class="skeleton" style="height:64px;border-radius:var(--radius-lg);"></div>
			{/each}
		</div>
	{:else if sorted.length === 0}
		<div class="panel">
			<div class="panel-body">
				<div class="empty-state">
					<div class="empty-state-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"/></svg>
					</div>
					<h3>No users monitored</h3>
					<p>Connect a tenant to start monitoring user behavior.</p>
				</div>
			</div>
		</div>
	{:else}
		<div style="display:flex;flex-direction:column;gap:8px;">
			{#each sorted as user (user.email)}
				<UserRiskRow {user} />
			{/each}
		</div>
	{/if}
</div>
