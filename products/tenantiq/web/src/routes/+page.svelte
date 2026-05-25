<script lang="ts">
	import DashboardContent from '$components/DashboardContent.svelte';
	import OnboardingWizard from '$components/onboarding/OnboardingWizard.svelte';
	import OnboardingChecklist from '$components/OnboardingChecklist.svelte';
	import SignInHero from '$components/landing/SignInHero.svelte';
	import { auth } from '$stores/auth';
	import { tenant } from '$stores/tenant';
	import { alerts } from '$stores/alerts';
	import { api } from '$api/client';
	import { createSSEConnection } from '$utils/sse';
	import { onMount } from 'svelte';
	import type { Alert, DashboardMetrics } from '$lib/types/shared';

	let metrics = $state<DashboardMetrics | null>(null);
	let recentAlerts = $state<Alert[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sseConnection: ReturnType<typeof createSSEConnection> | null = null;
	let mounted = $state(false);

	onMount(() => { mounted = true; });

	// No redirect to /platform -- dashboard handles signed-out state inline
	// The previous goto('/platform') caused a reset after auth callback

	$effect(() => {
		const tid = $tenant.currentTenantId, user = $auth.user;
		if (tid && user) { loadDashboard(tid); setupSSE(tid); }
	});

	$effect(() => { return () => { sseConnection?.disconnect(); }; });

	async function loadDashboard(tenantId: string) {
		// Show cached metrics instantly (stale-while-revalidate)
		const dashPath = `/tenants/${tenantId}/dashboard`;
		const alertPath = `/tenants/${tenantId}/alerts?status=active&limit=5`;

		loading = !metrics; // Only show skeleton on first load
		error = null;
		const TIMEOUT_MS = 12000;
		const timeout = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error(`Dashboard request timed out after ${TIMEOUT_MS/1000}s. The API may be unreachable — check your network or sign in again.`)), TIMEOUT_MS)
		);
		try {
			const [dash, alertData] = await Promise.race([
				Promise.all([
					api.getSWR<DashboardMetrics>(dashPath),
					api.getSWR<{ alerts: Alert[]; total: number }>(alertPath),
				]),
				timeout,
			]);
			metrics = dash; recentAlerts = alertData.alerts; alerts.set(alertData.alerts);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load dashboard';
			console.error('[Dashboard] load failed', { tenantId, error });
		}
		finally { loading = false; }
	}

	function setupSSE(tenantId: string) {
		if (sseConnection) sseConnection.disconnect();
		sseConnection = createSSEConnection(tenantId);
		sseConnection.on('new_alert', (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.alert) { alerts.addAlert(data.alert); recentAlerts = [data.alert, ...recentAlerts].slice(0, 5); }
			} catch (err) { console.error('[Dashboard] SSE parse', err); }
		});
		sseConnection.connect();
	}

	async function handleRemediate(alert: Alert) {
		const tid = $tenant.currentTenantId; if (!tid) return;
		try { await api.post(`/tenants/${tid}/alerts/${alert.id}/remediate`); api.invalidate(`/tenants/${tid}/dashboard`); alerts.updateAlert(alert.id, { status: 'resolved' }); recentAlerts = recentAlerts.filter(a => a.id !== alert.id); }
		catch (err) { console.error('[Dashboard] handleRemediate', err); }
	}

	async function handleDismiss(alert: Alert) {
		const tid = $tenant.currentTenantId; if (!tid) return;
		try { await api.patch(`/tenants/${tid}/alerts/${alert.id}`, { status: 'dismissed' }); api.invalidate(`/tenants/${tid}/dashboard`); alerts.updateAlert(alert.id, { status: 'dismissed' }); recentAlerts = recentAlerts.filter(a => a.id !== alert.id); }
		catch (err) { console.error('[Dashboard] handleDismiss', err); }
	}

	const currentTenant = $derived($tenant.tenants.find((t) => t.id === $tenant.currentTenantId));
	const needsOnboarding = $derived($tenant.currentTenantId && currentTenant && !currentTenant.lastSyncAt);
</script>

<svelte:head><title>Dashboard | TenantIQ</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
	{#if !$auth.user}
		<SignInHero />

	{:else if $tenant.tenantsLoading}
		<div class="space-y-8">
			<div class="h-8 w-48 skeleton rounded-lg"></div>
			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				{#each Array(4) as _, i}<div class="h-28 skeleton rounded-2xl delay-{i + 1}"></div>{/each}
			</div>
		</div>

	{:else if !$tenant.currentTenantId}
		<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
			<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.518a4.5 4.5 0 00-6.364-6.364L4.5 8.25l1.757 1.757"/></svg>
			</div>
			<h2 class="mb-2 text-xl font-semibold text-[var(--color-text)]">Connect a Tenant</h2>
			<p class="mb-6 text-[var(--color-text-secondary)]">Connect your Microsoft 365 tenant to start monitoring.</p>
			<a href="/settings" class="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)]">Connect Tenant</a>
		</div>

	{:else if needsOnboarding}
		<OnboardingWizard tenantId={$tenant.currentTenantId} tenantName={currentTenant?.displayName ?? 'Your Tenant'} onComplete={() => loadDashboard($tenant.currentTenantId!)} />

	{:else if loading}
		<div class="space-y-8">
			<div class="h-8 w-48 skeleton rounded-lg"></div>
			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				{#each Array(4) as _, i}<div class="h-28 skeleton rounded-2xl delay-{i + 1}"></div>{/each}
			</div>
		</div>

	{:else if error}
		<div class="animate-fade-up rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-5">
			<div class="flex items-center gap-3">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--color-danger)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
				<p class="text-sm font-medium text-[var(--color-danger)]">{error}</p>
			</div>
			<button onclick={() => loadDashboard($tenant.currentTenantId!)} class="mt-3 text-sm font-medium text-[var(--color-primary)] hover:underline">Try again</button>
		</div>

	{:else if metrics}
		<OnboardingChecklist hasSynced={!!currentTenant?.lastSyncAt} />
		<DashboardContent
			{metrics}
			{recentAlerts}
			tenantId={$tenant.currentTenantId}
			tenantName={currentTenant?.displayName}
			lastSyncAt={currentTenant?.lastSyncAt}
			userName={$auth.user.name.split(' ')[0]}
			onRefresh={() => loadDashboard($tenant.currentTenantId!)}
			onRemediate={handleRemediate}
			onDismiss={handleDismiss}
		/>
	{:else}
		<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
			<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
			</div>
			<h2 class="mb-2 text-xl font-semibold text-[var(--color-text)]">No data yet</h2>
			<p class="mb-6 text-[var(--color-text-secondary)]">Your tenant is connected but hasn't synced data yet. Run an initial sync to populate the dashboard.</p>
			<button onclick={() => loadDashboard($tenant.currentTenantId!)} class="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)]">Retry</button>
		</div>
	{/if}
</div>
