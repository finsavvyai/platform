<script lang="ts">
	import SignInLogsTable from '$lib/components/history/SignInLogsTable.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { formatNumber } from '$utils/format';
	import { untrack } from 'svelte';

	interface SignInLog {
		id: string; userDisplayName: string; userPrincipalName: string;
		appDisplayName: string; ipAddress: string; location: string;
		status: 'success' | 'failure' | 'interrupted';
		riskLevel: 'none' | 'low' | 'medium' | 'high';
		clientApp: string; createdAt: string;
	}
	interface SignInSummary {
		total: number; successful: number; failed: number;
		risky: number; uniqueUsers: number; retentionDays: number;
	}

	let logs = $state<SignInLog[]>([]);
	let summary = $state<SignInSummary | null>(null);
	let loading = $state(true);
	let filterStatus = $state('all');
	let filterRisk = $state('all');
	let filterUser = $state('');
	let page = $state(1);
	let hasMore = $state(false);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadLogs()); });

	async function loadLogs() {
		loading = true;
		try {
			const p = new URLSearchParams({ page: String(page), limit: '50' });
			if (filterStatus !== 'all') p.set('status', filterStatus);
			if (filterRisk !== 'all') p.set('riskLevel', filterRisk);
			if (filterUser) p.set('user', filterUser);
			const [logData, sumData] = await Promise.all([
				api.get<{ logs: SignInLog[]; total: number }>(`/tenants/${$tenant.currentTenantId}/signin-logs?${p}`),
				api.get<SignInSummary>(`/tenants/${$tenant.currentTenantId}/signin-logs/summary`)
			]);
			logs = logData.logs;
			hasMore = logData.logs.length === 50;
			summary = sumData;
		} catch (err) { console.error('[SignInLogs]', err); }
		finally { loading = false; }
	}

	async function exportLogs() {
		try {
			const result = await api.post<{ exportKey: string }>(`/tenants/${$tenant.currentTenantId}/signin-logs/export`);
			window.open(`/api/tenants/${$tenant.currentTenantId}/signin-logs/export/${result.exportKey}`, '_blank');
		} catch (err) { console.error('[SignInLogs] export', err); }
	}
</script>

<svelte:head><title>Sign-in Logs | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Sign-in Logs" description={"Authentication activity and risk analysis"}>
		<button onclick={exportLogs} class="btn-secondary">Export CSV</button>
	</PageHeader>

	{#if summary}
		{#if (summary as any).syncRequired}
			<div class="rounded-2xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 px-4 py-3 text-sm text-[var(--color-warning)]">
				Sync your tenant to populate sign-in log data.
			</div>
		{/if}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-5">
			<MetricCard title="Total Sign-ins" value={formatNumber(summary.total)} subtitle="In retention window" />
			<MetricCard title="Successful" value={formatNumber(summary.successful)} subtitle="{(summary.total ? (summary.successful / summary.total) * 100 : 0).toFixed(1)}% success rate" />
			<MetricCard title="Failed" value={formatNumber(summary.failed)} subtitle="Authentication failures" />
			<MetricCard title="Risky" value={formatNumber(summary.risky)} subtitle="Medium or high risk" />
			<MetricCard title="Unique Users" value={formatNumber(summary.uniqueUsers)} subtitle="Active identities" />
		</div>
	{/if}

	<div class="filter-bar">
		<select bind:value={filterStatus} onchange={() => { page = 1; loadLogs(); }} class="select-premium">
			<option value="all">All statuses</option>
			<option value="success">Success</option>
			<option value="failure">Failure</option>
			<option value="interrupted">Interrupted</option>
		</select>
		<select bind:value={filterRisk} onchange={() => { page = 1; loadLogs(); }} class="select-premium">
			<option value="all">All risk levels</option>
			<option value="high">High</option>
			<option value="medium">Medium</option>
			<option value="low">Low</option>
			<option value="none">None</option>
		</select>
		<div class="relative">
			<input bind:value={filterUser} oninput={() => { page = 1; loadLogs(); }} placeholder="Filter by user..." class="min-h-[44px] w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]" />
			{#if filterUser && !logs.some(l => l.userPrincipalName === filterUser)}
				{@const suggestions = [...new Set(logs.map(l => l.userPrincipalName))].filter(u => u.toLowerCase().includes(filterUser.toLowerCase())).slice(0, 8)}
				{#if suggestions.length > 0}
					<div class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
						{#each suggestions as user}
							<button type="button" onclick={() => { filterUser = user; page = 1; loadLogs(); }} class="block w-full px-3 py-2 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] truncate">{user}</button>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
		{#if filterUser}
			<button onclick={() => { filterUser = ''; page = 1; loadLogs(); }} class="text-xs text-[var(--color-primary)] hover:underline">Clear</button>
		{/if}
	</div>

	{#if loading}
		<div class="space-y-2">
			{#each Array(5) as _}<div class="h-14 animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"></div>{/each}
		</div>
	{:else if logs.length === 0}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
			<p class="text-sm text-[var(--color-text-secondary)]">No sign-in logs match your filters.</p>
		</div>
	{:else}
		<SignInLogsTable {logs} />
		<div class="flex items-center justify-between">
			<button onclick={() => { page--; loadLogs(); }} disabled={page === 1} class="min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] disabled:opacity-50">Previous</button>
			<span class="text-sm text-[var(--color-text-secondary)]">Page {page}</span>
			<button onclick={() => { page++; loadLogs(); }} disabled={!hasMore} class="min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] disabled:opacity-50">Next</button>
		</div>
	{/if}
</div>
