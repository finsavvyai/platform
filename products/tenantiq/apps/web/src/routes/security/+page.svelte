<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import CertificateTable from '$components/CertificateTable.svelte';
	import CertificateDetailPanel from '$components/CertificateDetailPanel.svelte';
	import PolicyComplianceTable from '$components/PolicyComplianceTable.svelte';
	import TrialGate from '$components/TrialGate.svelte';
	import { auth } from '$stores/auth';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { formatNumber } from '$utils/format';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';
	import { getLimit, isTrialOrFree } from '$lib/config/plan-limits';

	const plan = $derived($auth.user?.plan ?? 'trial');
	const isFree = $derived(isTrialOrFree(plan));
	const certLimit = $derived(getLimit(plan, 'licenses'));
	const policyLimit = $derived(getLimit(plan, 'cisControls'));

	interface Certificate {
		appName: string; appId: string; type: string;
		expiresAt: string; daysUntilExpiry: number; status: string;
	}
	interface Policy {
		category: string; name: string; current: string; recommended: string;
		status: string; severity: string; benchmark: string;
	}
	interface PolicySummary {
		total: number; compliant: number; partial: number;
		nonCompliant: number; missing: number; complianceScore: number;
	}

	let secureScore = $state<number | null>(null);
	let certificates = $state<Certificate[]>([]);
	let policies = $state<Policy[]>([]);
	let summary = $state<PolicySummary | null>(null);
	let loading = $state(true);
	let selectedCert = $state<Certificate | null>(null);

	$effect(() => { if ($tenant.currentTenantId) loadSecurity(); });

	async function loadSecurity() {
		loading = true;
		try {
			const tid = $tenant.currentTenantId;
			const [scoreData, certData, policyData] = await Promise.all([
				api.get<{ current?: number | null; secureScore?: number | null }>(`/tenants/${tid}/secure-score`),
				api.get<{ certificates: Certificate[] }>(`/tenants/${tid}/certificates`),
				api.get<{ policies: Policy[]; summary: PolicySummary }>(`/tenants/${tid}/policies`),
			]);
			secureScore = scoreData.current ?? scoreData.secureScore ?? null;
			certificates = certData.certificates;
			policies = policyData.policies;
			summary = policyData.summary;
		} catch (err) { console.error('[Security]', err); }
		finally { loading = false; }
	}

	const hasData = $derived(secureScore != null || certificates.length > 0 || summary?.total);
	const scoreLabel = $derived(secureScore == null ? 'Awaiting sync' : secureScore >= 70 ? 'Good' : secureScore >= 40 ? 'Needs Attention' : 'At Risk');
	const criticalCerts = $derived(certificates.filter(c => c.status === 'critical').length);
	const warningCerts = $derived(certificates.filter(c => c.status === 'warning').length);

	function handleExportCsv() {
		const certRows = certificates.map(c => ({ ...c, secureScore }));
		exportCsv(certRows, [
			{ key: 'appName', label: 'Application' }, { key: 'type', label: 'Type' },
			{ key: 'expiresAt', label: 'Expires At' }, { key: 'daysUntilExpiry', label: 'Days Until Expiry' },
			{ key: 'status', label: 'Status' },
		], 'security-certificates');
		toasts.success('Security data exported as CSV');
	}

	function handleExportJson() {
		exportJson({ secureScore, certificates, policies, summary }, { type: 'security' }, 'security-report');
		toasts.success('Security data exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied to clipboard');
	}

	let syncing = $state(false);
	async function triggerSync() {
		const tid = $tenant.currentTenantId;
		if (!tid || syncing) return;
		syncing = true;
		try {
			const res = await api.post<{ users?: number; licenses?: number; workspaces?: number; error?: string }>(`/tenants/${tid}/sync`);
			if (res.error) { toasts.error(res.error); }
			else { toasts.success(`Synced ${res.users ?? 0} users, ${res.licenses ?? 0} licenses, ${res.workspaces ?? 0} workspaces`); setTimeout(() => loadSecurity(), 1000); }
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Sync failed';
			toasts.error(msg.includes('token') ? 'Please sign out and sign in again to refresh Microsoft 365 access.' : msg);
		} finally { syncing = false; }
	}
</script>

<svelte:head><title>Security | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Health Check" description="Microsoft 365 security posture overview" iconPath="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z">
		{#if hasData}
			<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink} disabled={loading} />
		{/if}
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _, i}
				<div class="h-32 skeleton rounded-2xl delay-{i + 1}"></div>
			{/each}
		</div>

	{:else if !hasData}
		<div class="empty-state animate-fade-up">
			<div class="empty-state-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
			</div>
			<h2>Security data awaiting first sync</h2>
			<p>Run a sync to pull your Microsoft 365 Secure Score, certificate inventory, and policy compliance data.</p>
			<div style="margin-top: 24px; display: flex; align-items: center; justify-content: center; gap: 10px;">
				<button onclick={triggerSync} disabled={syncing} class="btn-primary">{syncing ? 'Syncing...' : 'Sync from Microsoft 365'}</button>
				<a href="/settings" class="btn-secondary">Settings</a>
			</div>
		</div>

	{:else}
		<div class="animate-fade-up delay-1 grid grid-cols-1 gap-4 sm:grid-cols-4">
			<div class="panel" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
				{#if secureScore != null}
					<ScoreRing score={secureScore} size={96} strokeWidth={7} label="/100" />
					<p class="micro-label" style="margin-top: 8px;">{scoreLabel}</p>
				{:else}
					<ScoreRing score={0} size={96} strokeWidth={7} label="/100" />
					<p class="micro-label" style="margin-top: 8px;">Calculating...</p>
				{/if}
			</div>
			{#if summary}
				<div class="animate-fade-up delay-2">
					<MetricCard title="Compliant" value={formatNumber(summary.compliant)} subtitle="of {summary.total} policies" href="/security/purview" icon="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" progress={summary.total > 0 ? (summary.compliant / summary.total) * 100 : 0} progressColor="var(--color-success)" />
				</div>
				<div class="animate-fade-up delay-3">
					<MetricCard title="Needs Attention" value={formatNumber(summary.partial + summary.nonCompliant)} subtitle="Partial or non-compliant" href="/security/purview" icon="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
				</div>
				<div class="animate-fade-up delay-4">
					<MetricCard title="Expiring Certs" value={formatNumber(criticalCerts + warningCerts)} subtitle="{criticalCerts} critical, {warningCerts} warning" icon="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
				</div>
			{/if}
		</div>

		{#if certificates.length > 0}
			<div class="animate-fade-up delay-2">
				<h2 class="section-title">Certificates</h2>
				{#if isFree && certificates.length > certLimit}
					<CertificateTable certificates={certificates.slice(0, certLimit)} onSelect={(c) => (selectedCert = c)} />
					<TrialGate {plan} feature="Certificates" previewCount={certLimit} totalCount={certificates.length} requiredPlan="starter" />
				{:else}
					<CertificateTable {certificates} onSelect={(c) => (selectedCert = c)} />
				{/if}
			</div>
		{/if}

		{#if policies.length > 0}
			<div class="animate-fade-up delay-3">
				<h2 class="section-title">Policy Compliance</h2>
				{#if isFree && policies.length > policyLimit}
					<PolicyComplianceTable policies={policies.slice(0, policyLimit)} />
					<TrialGate {plan} feature="Policy Checks" previewCount={policyLimit} totalCount={policies.length} requiredPlan="starter" />
				{:else}
					<PolicyComplianceTable {policies} />
				{/if}
			</div>
		{/if}

		{#if certificates.length === 0 && policies.length === 0}
			<div class="animate-fade-up delay-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
				<a href="/security/cis" class="panel" style="padding: 20px; transition: border-color 0.2s;">
					<h3 class="section-title" style="margin-bottom: 4px;">Run CIS Benchmark Scan</h3>
					<p style="font-size: 13px; color: var(--color-text-secondary);">100+ controls against your live tenant</p>
				</a>
				<a href="/security/copilot" class="panel" style="padding: 20px; transition: border-color 0.2s;">
					<h3 class="section-title" style="margin-bottom: 4px;">Copilot Readiness</h3>
					<p style="font-size: 13px; color: var(--color-text-secondary);">Data governance and oversharing assessment</p>
				</a>
			</div>
		{/if}
	{/if}
</div>

{#if selectedCert}
	<CertificateDetailPanel cert={selectedCert} onClose={() => (selectedCert = null)} />
{/if}
