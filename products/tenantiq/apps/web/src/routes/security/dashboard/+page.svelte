<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { api } from '$api/client';
	import { tenant } from '$stores/tenant';
	import { toasts } from '$stores/toast';
	import MetricCard from '$components/MetricCard.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import { untrack } from 'svelte';

	interface DashboardData {
		securityScore: number | null;
		riskLevel: string;
		mfa: { enabled: number; total: number; rate: number };
		conditionalAccess: { total: number; enabled: number };
		alerts: { total: number; critical: number; active: number };
		riskyUsers: { total: number; high: number };
	}
	interface PostureData {
		mfa: { total: number; registered: number; capable: number; adoptionRate: number };
		conditionalAccess: { totalPolicies: number; enabled: number };
		adminAccounts: { globalAdmins: number; recommendation: string };
		appCredentials: { total: number; expiringSoon: number };
	}
	interface ComplianceFramework {
		id: string; name: string; score: number;
		passedControls: number; totalControls: number;
	}
	interface Risk {
		category: string; severity: 'critical' | 'high' | 'medium' | 'low';
		title: string; description: string;
		affectedCount: number; recommendation: string;
	}

	let loading = $state(true);
	let dashboardData = $state<DashboardData | null>(null);
	let postureData = $state<PostureData | null>(null);
	let complianceData = $state<ComplianceFramework[]>([]);
	let risksData = $state<Risk[]>([]);

	const riskColor = $derived(
		dashboardData?.riskLevel === 'critical' ? 'var(--color-danger)'
		: dashboardData?.riskLevel === 'high' ? 'var(--color-warning)'
		: 'var(--color-success)'
	);
	const mfaRate = $derived(dashboardData?.mfa?.rate ?? 0);
	const activeAlerts = $derived(dashboardData?.alerts?.active ?? 0);
	const securityScore = $derived(dashboardData?.securityScore ?? 0);

	const postureMfaRegistered = $derived(postureData?.mfa?.registered ?? 0);
	const postureMfaTotal = $derived(postureData?.mfa?.total ?? 0);
	const postureMfaPct = $derived(postureData?.mfa?.adoptionRate ?? 0);
	const postureCAEnabled = $derived(postureData?.conditionalAccess?.enabled ?? 0);
	const postureAdmins = $derived(postureData?.adminAccounts?.globalAdmins ?? 0);
	const postureExpiring = $derived(postureData?.appCredentials?.expiringSoon ?? 0);

	const hasData = $derived(!!dashboardData);
	let refreshing = $state(false);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadAll()); });

	async function refresh() {
		refreshing = true;
		await loadAll();
		refreshing = false;
		toasts.success('Security dashboard refreshed');
	}

	async function loadAll() {
		loading = true;
		try {
			const [dash, posture, compliance, risks] = await Promise.allSettled([
				api.get<DashboardData>('/security/dashboard'),
				api.get<PostureData>('/security/posture'),
				api.get<{ frameworks: ComplianceFramework[] }>('/security/compliance'),
				api.get<{ risks: Risk[] }>('/security/risks'),
			]);
			if (dash.status === 'fulfilled') dashboardData = dash.value;
			if (posture.status === 'fulfilled') postureData = posture.value;
			if (compliance.status === 'fulfilled') complianceData = compliance.value.frameworks ?? [];
			if (risks.status === 'fulfilled') risksData = risks.value.risks ?? [];
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Failed to load security dashboard');
		} finally { loading = false; }
	}

	function severityPill(s: string) {
		if (s === 'critical') return 'pill-danger';
		if (s === 'high') return 'pill-warning';
		if (s === 'medium') return 'pill-warning';
		return 'pill-success';
	}
</script>

<svelte:head><title>Security Dashboard | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Security Dashboard" description="Detailed security posture analysis" iconPath="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z">
		{#if hasData}
			<button onclick={refresh} disabled={refreshing} class="btn-primary">
				{#if refreshing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>{/if}
				Refresh
			</button>
		{/if}
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _, i}<div class="h-28 skeleton rounded-2xl delay-{i + 1}"></div>{/each}
		</div>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _, i}<div class="h-24 skeleton rounded-2xl delay-{i + 1}"></div>{/each}
		</div>

	{:else if !hasData}
		<div class="empty-state animate-fade-up">
			<div class="empty-state-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
			</div>
			<h2>Security Dashboard</h2>
			<p>Connect your Microsoft 365 tenant to view security posture, compliance status, and active risks.</p>
			<a href="/settings" class="btn-primary" style="margin-top: 24px;">Connect your tenant</a>
		</div>

	{:else if dashboardData}
		<!-- Top row: Score + Metrics -->
		<div class="animate-fade-up delay-1 grid grid-cols-1 gap-4 sm:grid-cols-4">
			<div class="panel" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
				<ScoreRing score={securityScore} size={96} strokeWidth={7} label="/100" />
				<p class="micro-label" style="margin-top: 8px;">Security Score</p>
			</div>
			<MetricCard title="Risk Level" value={dashboardData.riskLevel ?? 'N/A'} subtitle="Overall posture" progressColor={riskColor} />
			<MetricCard title="MFA Coverage" value={`${mfaRate}%`} subtitle="Users with MFA enabled" progress={mfaRate} progressColor="var(--color-success)" />
			<MetricCard title="Active Alerts" value={String(activeAlerts)} subtitle="Require attention" href="/alerts" />
		</div>

		<!-- Security Posture -->
		{#if postureData}
			<div class="animate-fade-up delay-2">
				<h2 class="section-title">Security Posture</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
					<MetricCard title="MFA Enrollment" value={`${postureMfaRegistered}/${postureMfaTotal}`} subtitle={`${postureMfaPct}% enrolled`} progress={postureMfaPct} progressColor="var(--color-success)" />
					<MetricCard title="Conditional Access" value={String(postureCAEnabled)} subtitle="Active policies" />
					<MetricCard title="Admin Accounts" value={String(postureAdmins)} subtitle="Privileged users" />
					<MetricCard title="Expiring Credentials" value={String(postureExpiring)} subtitle="App secrets expiring soon" progressColor={postureExpiring > 0 ? 'var(--color-warning)' : 'var(--color-success)'} />
				</div>
			</div>
		{/if}

		<!-- Compliance -->
		{#if complianceData.length > 0}
			<div class="animate-fade-up delay-3">
				<h2 class="section-title">Compliance</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					{#each complianceData as fw}
						<div class="panel">
							<div class="panel-body">
								<div style="display: flex; align-items: center; justify-content: space-between;">
									<h3 class="micro-label">{fw.name}</h3>
									<span class="tabular-nums" style="font-size: 18px; font-weight: 700; color: {fw.score >= 80 ? 'var(--color-success)' : fw.score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'}">{fw.score}%</span>
								</div>
								<p style="margin-top: 4px; font-size: 13px; color: var(--color-text-secondary);">{fw.passedControls}/{fw.totalControls} controls passing</p>
								<div style="margin-top: 12px; height: 6px; overflow: hidden; border-radius: 999px; background: var(--color-border);">
									<div style="height: 100%; border-radius: 999px; transition: width 0.5s; width: {fw.score}%; background: {fw.score >= 80 ? 'var(--color-success)' : fw.score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'}"></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Active Risks -->
		<div class="animate-fade-up delay-4">
			<h2 class="section-title">Active Risks</h2>
			{#if risksData.length > 0}
				<div class="space-y-3">
					{#each risksData as risk}
						<div class="panel">
							<div class="panel-body" style="display: flex; align-items: flex-start; gap: 12px;">
								<span class="pill {severityPill(risk.severity)}" style="margin-top: 2px; text-transform: uppercase; font-size: 11px; font-weight: 600;">{risk.severity}</span>
								<div style="min-width: 0; flex: 1;">
									<h3 style="font-size: 14px; font-weight: 600; color: var(--color-text);">{risk.title}</h3>
									<p style="margin-top: 2px; font-size: 13px; color: var(--color-text-secondary);">{risk.description}</p>
									<p style="margin-top: 8px; font-size: 13px; color: var(--color-primary);">{risk.recommendation}</p>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="panel" style="text-align: center;">
					<div class="panel-body">
						<p style="font-size: 14px; color: var(--color-text-secondary);">No active risks detected</p>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
