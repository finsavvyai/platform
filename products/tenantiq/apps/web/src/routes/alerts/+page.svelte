<script lang="ts">
	import AlertCard from '$components/AlertCard.svelte';
	import SeverityBadge from '$components/SeverityBadge.svelte';
	import ConfirmModal from '$components/ConfirmModal.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import AlertAnalytics from '$components/AlertAnalytics.svelte';
	import TrialGate from '$components/TrialGate.svelte';
	import { tenant } from '$stores/tenant';
	import { auth } from '$stores/auth';
	import { api } from '$api/client';
	import { formatRelativeTime } from '$utils/format';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';
	import { getLimit, isTrialOrFree } from '$lib/config/plan-limits';
	import type { Alert, Severity } from '@tenantiq/shared';

	let alertList = $state<Alert[]>([]);
	let loading = $state(true);
	let filterSeverity = $state<Severity | 'all'>('all');
	let filterStatus = $state<string>('all');
	let remediateTarget = $state<Alert | null>(null);

	$effect(() => { if ($tenant.currentTenantId) loadAlerts(); });

	async function loadAlerts() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (filterStatus !== 'all') params.set('status', filterStatus);
			if (filterSeverity !== 'all') params.set('severity', filterSeverity);
			const data = await api.get<{ alerts: Alert[]; total: number }>(`/tenants/${$tenant.currentTenantId}/alerts?${params}`);
			alertList = data.alerts;
		} catch (err) { console.error('[Alerts] loadAlerts', err); }
		finally { loading = false; }
	}

	async function confirmRemediate() {
		if (!remediateTarget || !$tenant.currentTenantId) return;
		try {
			await api.post(`/tenants/${$tenant.currentTenantId}/alerts/${remediateTarget.id}/remediate`);
			alertList = alertList.map(a => a.id === remediateTarget!.id ? { ...a, status: 'resolved' as const } : a);
		} catch (err) { console.error('[Alerts] confirmRemediate', err); }
		remediateTarget = null;
	}

	async function handleDismiss(alert: Alert) {
		if (!$tenant.currentTenantId) return;
		try {
			await api.patch(`/tenants/${$tenant.currentTenantId}/alerts/${alert.id}`, { status: 'dismissed' });
			alertList = alertList.map(a => a.id === alert.id ? { ...a, status: 'dismissed' as const } : a);
		} catch (err) { console.error('[Alerts] handleDismiss', err); }
	}

	function handleExportCsv() {
		exportCsv(alertList, [
			{ key: 'id', label: 'ID' },
			{ key: 'title', label: 'Title' },
			{ key: 'severity', label: 'Severity' },
			{ key: 'status', label: 'Status' },
			{ key: 'category', label: 'Type' },
			{ key: 'description', label: 'Description' },
			{ key: 'createdAt', label: 'Detected At' },
		], 'alerts');
		toasts.success('Alerts exported as CSV');
	}

	function handleExportJson() {
		exportJson(alertList, { type: 'alerts', tenant: $tenant.tenants.find(t => t.id === $tenant.currentTenantId)?.displayName, filters: { status: filterStatus, severity: filterSeverity } }, 'alerts');
		toasts.success('Alerts exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied to clipboard');
	}

	const userPlan = $derived($auth.user?.plan ?? 'trial');
	const alertLimit = $derived(getLimit(userPlan, 'alerts'));
	const isGated = $derived(isTrialOrFree(userPlan));
	const previewAlerts = $derived(isGated ? alertList.slice(0, alertLimit) : alertList);
	const gatedAlerts = $derived(isGated && alertList.length > alertLimit);
</script>

<svelte:head><title>Alerts | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Alerts" description="Security and compliance alerts" iconPath="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0">
		<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink} disabled={alertList.length === 0} />
	</PageHeader>

	<div class="filter-bar">
		<select
			bind:value={filterStatus}
			onchange={loadAlerts}
			class="select-premium"
		>
			<option value="all">All statuses</option>
			<option value="active">Active</option>
			<option value="acknowledged">Acknowledged</option>
			<option value="resolved">Resolved</option>
			<option value="dismissed">Dismissed</option>
		</select>
		<select
			bind:value={filterSeverity}
			onchange={loadAlerts}
			class="select-premium"
		>
			<option value="all">All severities</option>
			<option value="critical">Critical</option>
			<option value="high">High</option>
			<option value="medium">Medium</option>
			<option value="low">Low</option>
		</select>
	</div>

	<AlertAnalytics />

	{#if loading}
		<div class="space-y-3">
			{#each Array(3) as _}<div class="h-20 skeleton rounded-xl"></div>{/each}
		</div>
	{:else if alertList.length === 0}
		<div class="empty-state">
			{#if filterStatus !== 'all' || filterSeverity !== 'all'}
				<!-- Filtered but no results -->
				<div class="empty-state-icon">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/></svg>
				</div>
				<h3 class="text-base font-semibold text-[var(--color-text)]">No alerts match your filters</h3>
				<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Try adjusting severity or status filters to see more results.</p>
				<button onclick={() => { filterStatus = 'all'; filterSeverity = 'all'; loadAlerts(); }} class="mt-4 text-sm font-medium text-[var(--color-primary)] hover:underline">Clear all filters</button>
			{:else}
				<!-- Truly empty — guide to scan -->
				<div class="empty-state-icon">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
				</div>
				<h3 class="text-lg font-semibold text-[var(--color-text)]">No active alerts</h3>
				<p class="mx-auto mt-2 max-w-sm text-sm text-[var(--color-text-secondary)]">
					Run a security scan to detect issues, or sync your tenant to pull alerts from Microsoft 365.
				</p>
				<div class="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3">
					<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center">
						<p class="text-lg font-bold text-[var(--color-text)]">0</p>
						<p class="text-[11px] text-[var(--color-text-secondary)]">Critical</p>
					</div>
					<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center">
						<p class="text-lg font-bold text-[var(--color-text)]">0</p>
						<p class="text-[11px] text-[var(--color-text-secondary)]">High</p>
					</div>
					<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center">
						<p class="text-lg font-bold text-[var(--color-text)]">0</p>
						<p class="text-[11px] text-[var(--color-text-secondary)]">Medium</p>
					</div>
				</div>
				<div class="mt-6 flex items-center justify-center gap-3">
					<a href="/ai" class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)]">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
						Run AI Scan
					</a>
					<a href="/security" class="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-bg-secondary)]">
						Security Overview
					</a>
				</div>
			{/if}
		</div>
	{:else}
		<div class="space-y-3">
			{#each previewAlerts as alert (alert.id)}
				<AlertCard {alert} onRemediate={(a) => (remediateTarget = a)} onDismiss={handleDismiss} />
			{/each}
		</div>
		{#if gatedAlerts}
			<TrialGate plan={userPlan} feature="alerts" previewCount={alertLimit} totalCount={alertList.length} requiredPlan="starter">
				{#snippet preview()}{/snippet}
			</TrialGate>
		{/if}
	{/if}
</div>

<ConfirmModal
	open={remediateTarget !== null}
	title="Confirm Remediation"
	description="This will execute the automated remediation action for this alert. Are you sure?"
	confirmLabel="Remediate"
	destructive={true}
	onConfirm={confirmRemediate}
	onCancel={() => (remediateTarget = null)}
/>
