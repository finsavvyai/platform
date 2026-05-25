<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-svelte';
	import { untrack } from 'svelte';

	type Severity = 'critical' | 'high' | 'medium' | 'low';
	type RiskType = 'external_forwarding' | 'external_redirect' | 'auto_delete'
		| 'permanent_delete' | 'suspicious_name' | 'forward_and_delete';

	interface Finding {
		userId: string;
		userPrincipalName?: string;
		ruleId: string;
		ruleName: string;
		enabled: boolean;
		riskType: RiskType;
		severity: Severity;
		detail: string;
		externalDomains: string[];
		remediation: string;
	}

	interface Summary {
		usersAudited: number;
		usersWithRules: number;
		totalRules: number;
		totalFindings: number;
		findingsBySeverity: Record<Severity, number>;
		findingsByType: Record<RiskType, number>;
	}

	let loading = $state(true);
	let scanning = $state(false);
	let summary = $state<Summary | null>(null);
	let findings = $state<Finding[]>([]);
	let severityFilter = $state<Severity | 'all'>('all');
	let typeFilter = $state<RiskType | 'all'>('all');

	$effect(() => { if ($tenant.currentTenantId) untrack(() => load()); });

	async function load() {
		const tenantId = $tenant.currentTenantId;
		if (!tenantId) return;
		loading = true;
		try {
			const res = await api.get<{ summary: Summary; findings: Finding[] }>(`/tenants/${tenantId}/inbox-rules`);
			summary = res.summary;
			findings = res.findings;
		} catch {
			toasts.error('Failed to load inbox-rule audit');
		} finally { loading = false; }
	}

	async function rescan() {
		scanning = true;
		try {
			await load();
			toasts.success(`Scanned ${summary?.usersAudited ?? 0} users — ${summary?.totalFindings ?? 0} finding(s)`);
		} finally { scanning = false; }
	}

	const filtered = $derived(findings.filter(f =>
		(severityFilter === 'all' || f.severity === severityFilter) &&
		(typeFilter === 'all' || f.riskType === typeFilter)
	));

	// Map severity to design-system tokens via CSS var() expressions so the
	// values track --color-danger / --color-warning / --color-info changes.
	const severityColor: Record<Severity, string> = {
		critical: 'var(--color-danger)',
		high: 'var(--color-warning-strong, var(--color-warning))',
		medium: 'var(--color-warning)',
		low: 'var(--color-info)',
	};

	const typeLabel: Record<RiskType, string> = {
		external_forwarding: 'External forwarding',
		external_redirect: 'External redirect (BEC)',
		forward_and_delete: 'Forward + delete (stealth exfiltration)',
		permanent_delete: 'Permanent delete',
		auto_delete: 'Auto delete',
		suspicious_name: 'Suspicious rule name',
	};
</script>

<svelte:head><title>Mailbox Rule Audit | TenantIQ</title></svelte:head>

<div class="page">
	<header>
		<h1><ShieldAlert size={22} /> Mailbox Rule Audit</h1>
		<p class="sub">Scans every active user's inbox rules for BEC indicators (external forwards, redirect-then-delete, hidden rule names).</p>
	</header>

	{#if loading}
		<div class="grid">{#each Array(4) as _}<div class="skel"></div>{/each}</div>
	{:else}
		<div class="actions">
			<button onclick={rescan} disabled={scanning} class="btn-primary">
				<RefreshCw size={14} /> {scanning ? 'Scanning...' : 'Re-scan'}
			</button>
		</div>

		{#if summary}
			<div class="metrics">
				<div class="metric"><span>Users audited</span><strong>{summary.usersAudited}</strong></div>
				<div class="metric"><span>Users with rules</span><strong>{summary.usersWithRules}</strong></div>
				<div class="metric"><span>Total rules</span><strong>{summary.totalRules}</strong></div>
				<div class="metric"><span>Findings</span><strong class={summary.totalFindings > 0 ? 'danger' : ''}>{summary.totalFindings}</strong></div>
			</div>

			<div class="severity-bar">
				{#each ['critical', 'high', 'medium', 'low'] as sev (sev)}
					{@const count = summary.findingsBySeverity[sev as Severity]}
					{#if count > 0}
						<button
							class="sev-pill"
							style="background: color-mix(in srgb, {severityColor[sev as Severity]} 15%, transparent); color: {severityColor[sev as Severity]};"
							onclick={() => severityFilter = severityFilter === sev ? 'all' : sev as Severity}
						>{count} {sev}</button>
					{/if}
				{/each}
				{#if severityFilter !== 'all' || typeFilter !== 'all'}
					<button class="clear" onclick={() => { severityFilter = 'all'; typeFilter = 'all'; }}>Clear filters</button>
				{/if}
			</div>
		{/if}

		{#if filtered.length === 0}
			<div class="empty">
				<AlertTriangle size={32} />
				<p>No findings{severityFilter !== 'all' ? ` at ${severityFilter} severity` : ''}.</p>
			</div>
		{:else}
			<div class="findings">
				{#each filtered as f (f.ruleId)}
					<div class="finding" style="border-left-color: {severityColor[f.severity]};">
						<div class="finding-head">
							<div class="finding-title">
								<span class="sev-tag" style="background: color-mix(in srgb, {severityColor[f.severity]} 15%, transparent); color: {severityColor[f.severity]};">
									{f.severity}{f.enabled ? '' : ' (disabled)'}
								</span>
								<span class="finding-type">{typeLabel[f.riskType]}</span>
							</div>
							<div class="finding-user">{f.userPrincipalName ?? f.userId}</div>
						</div>
						<p class="finding-detail">{f.detail}</p>
						{#if f.externalDomains.length > 0}
							<div class="domains">
								<span class="label">External domains:</span>
								{#each f.externalDomains as d}<code>{d}</code>{/each}
							</div>
						{/if}
						<p class="remediation"><strong>Remediation:</strong> {f.remediation}</p>
						{#if f.ruleName}
							<p class="rule-name">Rule: <code>{f.ruleName}</code></p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.page { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
	header h1 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; margin: 0; }
	.sub { color: var(--color-text-secondary, #6b7280); margin: 0.5rem 0 1.5rem 0; }
	.grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(4, 1fr); }
	.skel { height: 5rem; border-radius: 0.5rem; background: var(--color-bg-tertiary, #e5e7eb); animation: pulse 1.5s infinite; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
	.actions { margin-bottom: 1.25rem; }
	.btn-primary { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem; border: none; border-radius: 0.5rem; background: var(--color-primary, #2563eb); color: #fff; font-weight: 500; cursor: pointer; }
	.btn-primary:disabled { opacity: 0.5; cursor: wait; }
	.metrics { display: grid; gap: 0.75rem; grid-template-columns: repeat(4, 1fr); margin-bottom: 1rem; }
	.metric { padding: 0.875rem 1rem; border: 1px solid var(--color-border); border-radius: 0.5rem; background: var(--color-surface); }
	.metric span { display: block; font-size: 0.75rem; color: var(--color-text-secondary); }
	.metric strong { font-size: 1.5rem; font-weight: 600; }
	.metric strong.danger { color: var(--color-danger); }
	.severity-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
	.sev-pill { padding: 0.375rem 0.75rem; border: none; border-radius: 1rem; font-size: 0.75rem; font-weight: 500; cursor: pointer; text-transform: capitalize; }
	.clear { padding: 0.375rem 0.75rem; border-radius: 1rem; background: transparent; border: 1px solid var(--color-border); cursor: pointer; font-size: 0.75rem; color: var(--color-text-secondary); }
	.empty { text-align: center; padding: 3rem; color: var(--color-text-secondary); display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
	.findings { display: flex; flex-direction: column; gap: 0.75rem; }
	.finding { padding: 1rem; border: 1px solid var(--color-border); border-left: 4px solid; border-radius: 0.5rem; background: var(--color-surface); }
	.finding-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
	.finding-title { display: flex; align-items: center; gap: 0.5rem; }
	.sev-tag { padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; }
	.finding-type { font-weight: 500; font-size: 0.875rem; }
	.finding-user { font-size: 0.8125rem; color: var(--color-text-secondary); font-family: 'SF Mono', Menlo, monospace; }
	.finding-detail { margin: 0 0 0.5rem 0; font-size: 0.875rem; }
	.domains { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
	.domains .label { font-size: 0.75rem; color: var(--color-text-secondary); }
	.domains code { padding: 0.125rem 0.375rem; background: color-mix(in srgb, var(--color-danger) 10%, transparent); border-radius: 0.25rem; font-size: 0.75rem; color: var(--color-danger); }
	.remediation { margin: 0.5rem 0 0 0; padding: 0.5rem; background: var(--color-bg-tertiary, #f9fafb); border-radius: 0.375rem; font-size: 0.8125rem; }
	.rule-name { margin: 0.5rem 0 0 0; font-size: 0.75rem; color: var(--color-text-secondary); }
	.rule-name code { padding: 0.125rem 0.375rem; background: var(--color-bg-tertiary, #f3f4f6); border-radius: 0.25rem; font-family: 'SF Mono', Menlo, monospace; font-size: 0.75rem; }
	@media (max-width: 768px) { .grid, .metrics { grid-template-columns: repeat(2, 1fr); } }
</style>
