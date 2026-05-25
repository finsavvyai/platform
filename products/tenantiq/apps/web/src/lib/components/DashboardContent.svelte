<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import AlertCard from '$components/AlertCard.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import QuickActions from '$components/dashboard/QuickActions.svelte';
	import SyncProgressBar from '$components/SyncProgressBar.svelte';
	// Lazy loaded below-fold components
	const RiskyUsersListP = import('$components/dashboard/RiskyUsersList.svelte');
	const LicenseUtilizationP = import('$components/dashboard/LicenseUtilization.svelte');
	import { formatCurrency, formatNumber, formatRelativeTime } from '$utils/format';
	import { exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';
	import { api } from '$api/client';
	import type { Alert, DashboardMetrics } from '@tenantiq/shared';

	interface Props {
		metrics: DashboardMetrics;
		recentAlerts: Alert[];
		tenantId?: string;
		tenantName?: string;
		lastSyncAt?: string | null;
		userName: string;
		onRefresh: () => void;
		onRemediate: (alert: Alert) => void;
		onDismiss: (alert: Alert) => void;
	}

	let { metrics, recentAlerts, tenantId, tenantName, lastSyncAt, userName, onRefresh, onRemediate, onDismiss }: Props = $props();

	let syncing = $state(false);
	let showProgress = $state(false);
	const totalAlerts = $derived(metrics.activeAlerts.critical + metrics.activeAlerts.high + metrics.activeAlerts.medium + metrics.activeAlerts.low);
	const score = $derived(metrics.secureScore ?? 0);
	const scoreColor = $derived(score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-danger)');
	const wastePercent = $derived(metrics.totalLicenseSpend > 0 ? Math.round((metrics.licenseWaste / (metrics.totalLicenseSpend + metrics.licenseWaste)) * 100) : 0);
	const syncTime = $derived(metrics.lastSyncAt ?? lastSyncAt ?? null);
	const displayAlerts = $derived(metrics.recentAlerts?.length ? metrics.recentAlerts : recentAlerts);

	function handleExportJson() {
		exportJson({ metrics, alerts: displayAlerts }, { type: 'dashboard', tenant: tenantName }, 'dashboard');
		toasts.success('Dashboard exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied to clipboard');
	}

	async function handleSync() {
		if (!tenantId || syncing) return;
		syncing = true;
		showProgress = true;
		try {
			await api.post(`/tenants/${tenantId}/sync`);
		} catch (err) {
			toasts.error(err instanceof Error ? err.message : 'Sync failed');
		} finally {
			syncing = false;
		}
	}

	function handleSyncComplete() {
		showProgress = false;
		syncing = false;
		onRefresh();
		toasts.success('Sync complete');
	}

	const greeting = $derived.by(() => {
		const h = new Date().getHours();
		if (h < 12) return 'Good morning';
		if (h < 17) return 'Good afternoon';
		return 'Good evening';
	});
</script>

<!-- Header -->
<PageHeader title="{greeting}, {userName}" description="{tenantName}{syncTime ? ` · Last sync ${formatRelativeTime(syncTime)}` : ''}" iconPath="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z">
	<ExportMenu onExportJson={handleExportJson} onCopyLink={handleCopyLink} />
</PageHeader>

<!-- Row 1: Key metrics -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<div class="animate-fade-up delay-1">
		<MetricCard title="Secure Score" value={score > 0 ? `${score}%` : '--'} subtitle={score >= 70 ? 'Good posture' : score >= 40 ? 'Needs attention' : score > 0 ? 'At risk' : 'Sync to calculate'} href="/security" icon="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" progress={score} progressColor={scoreColor} />
	</div>
	<div class="animate-fade-up delay-2">
		<MetricCard title="Users" value={formatNumber(metrics.userBreakdown?.total ?? metrics.totalUsers)} subtitle="{formatNumber(metrics.userBreakdown?.active ?? metrics.activeUsers)} active, {formatNumber(metrics.userBreakdown?.inactive ?? 0)} inactive, {formatNumber(metrics.userBreakdown?.disabled ?? 0)} disabled" icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
	</div>
	<div class="animate-fade-up delay-3">
		<MetricCard title="License Cost" value={formatCurrency(metrics.totalLicenseSpend)} subtitle="{formatCurrency(metrics.licenseWaste)} waste ({wastePercent}%)" href="/licenses" icon="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
	</div>
	<div class="animate-fade-up delay-4">
		<MetricCard title="Open Alerts" value={formatNumber(totalAlerts)} subtitle="{metrics.activeAlerts.critical} critical, {metrics.activeAlerts.high} high" href="/alerts" icon="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
	</div>
</div>

<!-- Row 2: Quick actions + sync progress -->
<QuickActions lastSyncAt={syncTime} tenantId={tenantId ?? ''} onSync={handleSync} {syncing} />
{#if showProgress && tenantId}
	<SyncProgressBar {tenantId} onComplete={handleSyncComplete} />
{/if}

<!-- Row 3: Alerts + Risky Users -->
<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
	<section class="animate-fade-up delay-3">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="section-title">Recent Alerts</h2>
			<a href="/alerts" class="text-sm font-medium text-[var(--color-primary)] transition-colors hover:opacity-80">View all</a>
		</div>
		{#if displayAlerts.length === 0}
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
				<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success)]/10">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
				</div>
				<p class="text-sm font-medium text-[var(--color-text)]">All clear</p>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">No active alerts. Your tenant is healthy.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each displayAlerts.slice(0, 5) as alert (alert.id)}
					<AlertCard {alert} onRemediate={onRemediate} onDismiss={onDismiss} />
				{/each}
			</div>
		{/if}
	</section>

	{#await RiskyUsersListP then { default: RiskyUsersList }}
		<RiskyUsersList users={metrics.topRiskyUsers ?? []} />
	{/await}
</div>

<!-- Row 4: License utilization -->
{#await LicenseUtilizationP then { default: LicenseUtilization }}
	<LicenseUtilization breakdown={metrics.licenseBreakdown ?? []} utilization={metrics.licenseUtilization ?? 0} />
{/await}
