<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import ChatTab from '$components/ai/ChatTab.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';

	// ─── Types ────────────────────────────────────────────────────────────────

	interface AIStatus {
		openclaw: string;
		features: Record<string, boolean>;
		agentCount?: number;
	}

	interface SecurityAnalysis {
		riskScore: number;
		criticalFindings: string[];
		recommendations: string[];
		complianceGaps: string[];
		estimatedRemediationHours: number;
	}

	interface LicenseAnalysis {
		wastedLicenses: number;
		estimatedMonthlySavings: number;
		recommendations: Array<{ action: string; priority: string }>;
	}

	// ─── State ────────────────────────────────────────────────────────────────

	let activeTab = $state<'chat' | 'scan' | 'optimize' | 'chain'>('chat');

	// AI Status
	let aiStatus = $state<AIStatus | null>(null);
	let loadingStatus = $state(false);

	// Security Scan
	let scanResult = $state<{ source: string; analysis: SecurityAnalysis } | null>(null);
	let scanning = $state(false);

	// License Optimization
	let optimizeResult = $state<{ source: string; analysis: LicenseAnalysis } | null>(null);
	let optimizing = $state(false);

	// Chain
	let chainPreset = $state<'security-audit' | 'compliance-check' | 'cost-review' | 'full-assessment'>('full-assessment');
	let chainResult = $state<string | null>(null);
	let chaining = $state(false);

	// ─── Load on tenant change ────────────────────────────────────────────────

	$effect(() => {
		if ($tenant.currentTenantId) loadAIStatus();
	});

	async function loadAIStatus() {
		loadingStatus = true;
		try {
			aiStatus = await api.get<AIStatus>('/ai/status');
		} catch {
			aiStatus = null;
		} finally {
			loadingStatus = false;
		}
	}

	// ─── Security Scan ────────────────────────────────────────────────────────

	async function runSecurityScan() {
		if (!$tenant.currentTenantId || scanning) return;
		scanning = true;
		scanResult = null;
		try {
			scanResult = await api.post(`/ai/security-scan/${$tenant.currentTenantId}`, {});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Scan failed';
			scanResult = {
				source: 'error',
				analysis: { riskScore: 0, criticalFindings: [msg], recommendations: [], complianceGaps: [], estimatedRemediationHours: 0 }
			};
		} finally {
			scanning = false;
		}
	}

	// ─── License Optimization ─────────────────────────────────────────────────

	async function runLicenseOptimize() {
		if (!$tenant.currentTenantId || optimizing) return;
		optimizing = true;
		optimizeResult = null;
		try {
			optimizeResult = await api.post(`/ai/license-optimize/${$tenant.currentTenantId}`, {});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Optimization failed';
			optimizeResult = {
				source: 'error',
				analysis: { wastedLicenses: 0, estimatedMonthlySavings: 0, recommendations: [{ action: msg, priority: 'high' }] }
			};
		} finally {
			optimizing = false;
		}
	}

	// ─── Multi-Agent Chain ────────────────────────────────────────────────────

	async function runChain() {
		if (!$tenant.currentTenantId || chaining) return;
		chaining = true;
		chainResult = null;
		try {
			const res = await api.post<{ result: string; source: string }>(`/ai/chain/${$tenant.currentTenantId}`, { preset: chainPreset });
			chainResult = res.result;
		} catch (e: unknown) {
			chainResult = `Error: ${e instanceof Error ? e.message : 'Chain failed'}`;
		} finally {
			chaining = false;
		}
	}

	// ─── Export ───────────────────────────────────────────────────────────────

	function handleExportJson() {
		const exportData = { scanResult, optimizeResult, chainResult };
		exportJson(exportData, { type: 'ai-analysis' }, 'ai-analysis');
		toasts.success('AI analysis exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied to clipboard');
	}

	// ─── Risk score color helper ──────────────────────────────────────────────
	function riskColor(score: number) {
		if (score >= 70) return 'text-red-500';
		if (score >= 40) return 'text-yellow-500';
		return 'text-green-500';
	}
</script>

<svelte:head>
	<title>AI Engine | TenantIQ</title>
</svelte:head>

<div class="page-container-wide" style="display:flex;flex-direction:column;gap:16px;height:calc(100vh - 7rem);">
	<!-- Header -->
	<PageHeader title="AI Agent" description="AI-powered security scanning and optimization" iconPath="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z">
		<div style="display:flex;align-items:center;gap:8px;">
			<ExportMenu onExportJson={handleExportJson} onCopyLink={handleCopyLink} disabled={!scanResult && !optimizeResult && !chainResult} />
			{#if aiStatus}
				<span class="pill-{aiStatus.openclaw === 'connected' ? 'success' : 'warning'}" style="display:inline-flex;align-items:center;gap:6px;">
					<span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;"></span>
					{aiStatus.openclaw === 'connected' ? `OpenClaw (${aiStatus.agentCount} agents)` : 'Anthropic fallback'}
				</span>
			{/if}
		</div>
	</PageHeader>

	<!-- Tabs -->
	<div class="filter-bar" style="width:fit-content;padding:3px;border-radius:var(--radius-lg);background:var(--color-bg);">
		{#each [
			{ id: 'chat', label: 'Chat' },
			{ id: 'scan', label: 'Security Scan' },
			{ id: 'optimize', label: 'License Optimize' },
			{ id: 'chain', label: 'Analysis Chain' },
		] as tab}
			<button
				onclick={() => activeTab = tab.id as typeof activeTab}
				class="{activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}"
				style="padding:6px 16px;font-size:13px;min-height:auto;"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div style="flex:1;overflow:hidden;">

		<!-- ── CHAT TAB ──────────────────────────────────────────────────── -->
		{#if activeTab === 'chat'}
			<ChatTab />

		<!-- ── SECURITY SCAN TAB ─────────────────────────────────────────── -->
		{:else if activeTab === 'scan'}
			<div class="panel" style="height:100%;overflow:auto;">
				<div class="panel-header">
					<div>
						<h2 class="panel-title">AI Security Posture Scan</h2>
						<p style="margin-top:4px;font-size:13px;color:var(--color-text-secondary);">
							Uses the 365-security Luna agent to analyze your tenant's security posture, identify risks, and generate recommendations.
						</p>
					</div>
					<button
						onclick={runSecurityScan}
						disabled={scanning || !$tenant.currentTenantId}
						class="btn-primary"
					>
						{#if scanning}
							<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
							Scanning...
						{:else}
							Run Scan
						{/if}
					</button>
				</div>
				<div class="panel-body">
					{#if scanResult}
						{@const a = scanResult.analysis}
						<div style="display:flex;flex-direction:column;gap:16px;">
							<!-- Risk Score -->
							<div class="panel" style="display:flex;align-items:center;gap:16px;padding:16px;">
								<div style="text-align:center;">
									<div class="tabular-nums {riskColor(a.riskScore)}" style="font-size:36px;font-weight:700;">{a.riskScore}</div>
									<span class="micro-label">Risk Score /100</span>
								</div>
								<div style="flex:1;">
									<span class="section-title">
										{a.riskScore >= 70 ? 'High Risk' : a.riskScore >= 40 ? 'Medium Risk' : 'Low Risk'}
									</span>
									<div style="height:8px;overflow:hidden;border-radius:99px;background:var(--color-bg);margin-top:8px;">
										<div
											style="height:100%;border-radius:99px;width:{a.riskScore}%;background:{a.riskScore >= 70 ? 'var(--color-danger)' : a.riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)'};"
										></div>
									</div>
									<span class="micro-label" style="margin-top:6px;">Powered by {scanResult.source}</span>
								</div>
							</div>

							<!-- Critical Findings -->
							{#if a.criticalFindings.length > 0}
								<div class="panel" style="border-color:var(--color-danger);padding:16px;">
									<h3 class="section-title" style="color:var(--color-danger);margin-bottom:8px;">
										Critical Findings ({a.criticalFindings.length})
									</h3>
									<ul style="display:flex;flex-direction:column;gap:4px;">
										{#each a.criticalFindings as finding}
											<li style="font-size:13px;color:var(--color-danger);">&#x2022; {finding}</li>
										{/each}
									</ul>
								</div>
							{/if}

							<!-- Recommendations -->
							{#if a.recommendations.length > 0}
								<div class="panel" style="border-color:var(--color-success);padding:16px;">
									<h3 class="section-title" style="color:var(--color-success);margin-bottom:8px;">
										Recommendations
									</h3>
									<ul style="display:flex;flex-direction:column;gap:4px;">
										{#each a.recommendations as rec}
											<li style="font-size:13px;color:var(--color-success);">&#x2022; {rec}</li>
										{/each}
									</ul>
								</div>
							{/if}

							<!-- Compliance Gaps -->
							{#if a.complianceGaps.length > 0}
								<div class="panel" style="padding:16px;">
									<h3 class="section-title" style="margin-bottom:8px;">Compliance Gaps</h3>
									<ul style="display:flex;flex-direction:column;gap:4px;">
										{#each a.complianceGaps as gap}
											<li style="font-size:13px;color:var(--color-text-secondary);">&#x2022; {gap}</li>
										{/each}
									</ul>
								</div>
							{/if}

							<p class="micro-label">
								Estimated remediation time: <strong class="tabular-nums">{a.estimatedRemediationHours}h</strong>
							</p>
						</div>
					{:else if !scanning}
						<div class="empty-state">
							<div class="empty-state-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
							</div>
							<h3>Ready to Scan</h3>
							<p>Click "Run Scan" to analyze your tenant's security posture</p>
						</div>
					{/if}
				</div>
			</div>

		<!-- ── LICENSE OPTIMIZE TAB ──────────────────────────────────────── -->
		{:else if activeTab === 'optimize'}
			<div class="panel" style="height:100%;overflow:auto;">
				<div class="panel-header">
					<div>
						<h2 class="panel-title">AI License Optimization</h2>
						<p style="margin-top:4px;font-size:13px;color:var(--color-text-secondary);">
							Uses the license-optimizer Luna agent to identify wasted licenses, inactive users, and cost savings opportunities.
						</p>
					</div>
					<button
						onclick={runLicenseOptimize}
						disabled={optimizing || !$tenant.currentTenantId}
						class="btn-primary"
					>
						{#if optimizing}
							<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
							Analyzing...
						{:else}
							Optimize
						{/if}
					</button>
				</div>
				<div class="panel-body">
					{#if optimizeResult}
						{@const a = optimizeResult.analysis}
						<div style="display:flex;flex-direction:column;gap:16px;">
							<!-- Summary Cards -->
							<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
								<div class="panel" style="padding:20px;text-align:center;">
									<div class="tabular-nums" style="font-size:32px;font-weight:700;color:var(--color-warning);">{a.wastedLicenses}</div>
									<span class="micro-label">Wasted Licenses</span>
								</div>
								<div class="panel" style="padding:20px;text-align:center;border-color:var(--color-success);">
									<div class="tabular-nums" style="font-size:32px;font-weight:700;color:var(--color-success);">${(a.estimatedMonthlySavings ?? 0).toFixed(0)}</div>
									<span class="micro-label">Est. Monthly Savings</span>
								</div>
							</div>

							<!-- Recommendations -->
							{#if a.recommendations.length > 0}
								<div class="panel" style="padding:16px;">
									<h3 class="section-title" style="margin-bottom:12px;">Optimization Actions</h3>
									<div style="display:flex;flex-direction:column;gap:8px;">
										{#each a.recommendations as rec}
											<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:var(--radius-md);background:var(--color-bg);">
												<span class="pill-{rec.priority === 'high' ? 'danger' : rec.priority === 'medium' ? 'warning' : 'muted'}" style="font-size:11px;flex-shrink:0;">
													{rec.priority.toUpperCase()}
												</span>
												<span style="font-size:13px;color:var(--color-text);">{rec.action}</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<span class="micro-label">Powered by {optimizeResult.source}</span>
						</div>
					{:else if !optimizing}
						<div class="empty-state">
							<div class="empty-state-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
							</div>
							<h3>License Optimization</h3>
							<p>Click "Optimize" to find license savings opportunities</p>
						</div>
					{/if}
				</div>
			</div>

		<!-- ── CHAIN TAB ─────────────────────────────────────────────────── -->
		{:else if activeTab === 'chain'}
			<div class="panel" style="height:100%;overflow:auto;">
				<div class="panel-header">
					<div>
						<h2 class="panel-title">Multi-Agent Analysis Chain</h2>
						<p style="margin-top:4px;font-size:13px;color:var(--color-text-secondary);">
							Run a coordinated analysis using multiple Luna agents for comprehensive insights.
							Requires OpenClaw to be configured.
						</p>
					</div>
				</div>
				<div class="panel-body">
					<div class="filter-bar" style="margin-bottom:20px;">
						<div style="flex:1;">
							<label for="ai-preset" class="micro-label" style="margin-bottom:6px;display:block;">Analysis Preset</label>
							<select id="ai-preset" bind:value={chainPreset} class="select-premium" style="width:100%;">
								<option value="security-audit">Security Audit -- Full security assessment</option>
								<option value="compliance-check">Compliance Check -- SOC2/GDPR gap analysis</option>
								<option value="cost-review">Cost Review -- License & cost optimization</option>
								<option value="full-assessment">Full Assessment -- Complete tenant health report</option>
							</select>
						</div>
						<div style="align-self:flex-end;">
							<button
								onclick={runChain}
								disabled={chaining || !$tenant.currentTenantId}
								class="btn-primary"
							>
								{#if chaining}
									<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
									Running chain...
								{:else}
									Run Chain
								{/if}
							</button>
						</div>
					</div>

					{#if chainResult}
						<div class="panel" style="padding:16px;background:var(--color-bg);">
							<h3 class="section-title" style="margin-bottom:12px;">Chain Analysis Result</h3>
							<pre style="white-space:pre-wrap;font-size:13px;color:var(--color-text);">{chainResult}</pre>
						</div>
					{:else if !chaining}
						<div class="empty-state">
							<div class="empty-state-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>
							</div>
							<h3>Multi-Agent Chain</h3>
							<p>Select a preset and click "Run Chain" for comprehensive analysis</p>
							{#if !aiStatus?.features?.multiAgentChains}
								<p style="margin-top:8px;font-size:12px;color:var(--color-warning);">Requires OPENCLAW_URL to be configured</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
