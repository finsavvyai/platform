<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import SectionScoreCard from '$lib/components/cis/SectionScoreCard.svelte';
	import ControlTable from '$lib/components/cis/ControlTable.svelte';
	import CriticalFixSummary from '$lib/components/cis/CriticalFixSummary.svelte';
	import ScoreTrendChart from '$lib/components/cis/ScoreTrendChart.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import TrialGate from '$components/TrialGate.svelte';
	import { tenant } from '$stores/tenant';
	import { auth } from '$stores/auth';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { getLimit, isTrialOrFree } from '$lib/config/plan-limits';
	import { exportJson, copyToClipboard } from '$utils/export';

	interface ScanResult {
		overallScore: number | null;
		passCount: number; failCount: number; partialCount: number; totalControls: number;
		sectionScores: Record<string, { pass: number; fail: number; total: number; score: number }>;
		controls: any[];
		scannedAt?: string;
	}

	interface TrendPoint {
		date: string; score: number; passCount: number; failCount: number;
		partialCount: number; scansThatDay: number;
	}
	interface TrendSummary {
		windowDays: number; scanCount: number;
		latestScore: number | null; earliestScore: number | null;
		scoreDelta: number; direction: 'improving' | 'regressing' | 'stable';
	}

	let result = $state<ScanResult | null>(null);
	let loading = $state(true);
	let scanning = $state(false);
	let filterSection = $state('all');
	let filterStatus = $state('all');
	let trend = $state<{ points: TrendPoint[]; summary: TrendSummary } | null>(null);

	$effect(() => { if ($tenant.currentTenantId) { loadLatest(); loadTrend(); } });

	async function loadLatest() {
		loading = true;
		try {
			result = await api.get<ScanResult>('/cis-benchmark/latest');
		} catch { result = null; }
		finally { loading = false; }
	}

	async function loadTrend() {
		try {
			trend = await api.get<{ points: TrendPoint[]; summary: TrendSummary }>('/cis-benchmark/trend?days=30');
		} catch { trend = null; }
	}

	async function runScan() {
		scanning = true;
		try {
			const res = await api.post<{ success: boolean; result: ScanResult; error?: string }>('/cis-benchmark/scan');
			if (res.error) { toasts.error(res.error); }
			else { result = res.result; toasts.success(`CIS scan complete: ${res.result.overallScore}% compliance`); loadTrend(); }
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Scan failed');
		} finally { scanning = false; }
	}

	function handleExportJson() {
		if (!result) return;
		exportJson(result, { type: 'cis-benchmark' }, 'cis-benchmark');
		toasts.success('CIS results exported');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied');
	}

	function timeSince(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	const sections = $derived(result?.sectionScores ? Object.entries(result.sectionScores) : []);
	const hasData = $derived(result && result.totalControls > 0);
	const scoreLabel = $derived(!result?.overallScore ? 'Not scanned' : result.overallScore >= 80 ? 'Good' : result.overallScore >= 50 ? 'Needs Work' : 'At Risk');
	const failedControls = $derived(
		result?.controls?.filter((c: any) => c.status === 'fail' || c.status === 'partial') ?? []
	);

	const userPlan = $derived($auth.user?.plan ?? 'trial');
	const cisLimit = $derived(getLimit(userPlan, 'cisControls'));
	const isGated = $derived(isTrialOrFree(userPlan));
	const previewControls = $derived(
		isGated && result?.controls ? result.controls.slice(0, cisLimit) : result?.controls ?? []
	);
</script>

<svelte:head><title>CIS Benchmark | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="CIS Benchmark" description="Microsoft 365 Foundations Benchmark v3.1{result?.scannedAt ? ` · Last scan: ${timeSince(result.scannedAt)}` : ''}" iconPath="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z">
		{#if hasData}<ExportMenu onExportJson={handleExportJson} onCopyLink={handleCopyLink} />{/if}
		<button onclick={runScan} disabled={scanning} class="btn-primary">
			{#if scanning}
				<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
				Scanning...
			{:else}
				Run CIS Scan
			{/if}
		</button>
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-5">
			{#each Array(5) as _, i}<div class="h-28 skeleton rounded-2xl delay-{i + 1}"></div>{/each}
		</div>
	{:else if !hasData}
		<div class="empty-state animate-fade-up">
			<div class="empty-state-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
			</div>
			<h2>CIS Benchmark Assessment</h2>
			<p>Scan your Microsoft 365 tenant against CIS Foundations Benchmark v3.1 -- evaluating MFA, Conditional Access, admin roles, DLP, and audit policies.</p>
			<div style="margin-top: 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px;">
				{#each ['Identity', 'Application', 'Data', 'Email', 'Audit'] as section}
					<span class="pill-muted">{section}</span>
				{/each}
			</div>
			<button onclick={runScan} disabled={scanning} class="btn-primary" style="margin-top: 24px;">
				{#if scanning}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Scanning...{:else}Run First CIS Scan{/if}
			</button>
		</div>
	{:else if result}
		<!-- Score overview -->
		<div class="animate-fade-up delay-1 grid grid-cols-1 gap-4 sm:grid-cols-5">
			<div class="panel" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
				<ScoreRing score={result.overallScore ?? 0} size={96} strokeWidth={7} label="/100" />
				<p class="micro-label" style="margin-top: 8px;">{scoreLabel}</p>
			</div>
			{#each sections as [name, data], i}
				<div class="animate-fade-up delay-{i + 2}">
					<SectionScoreCard section={name} score={data.score} pass={data.pass} fail={data.fail} total={data.total} />
				</div>
			{/each}
		</div>

		<!-- Critical fix summary -->
		{#if failedControls.length > 0}
			<div class="animate-fade-up delay-2">
				<CriticalFixSummary controls={failedControls} />
			</div>
		{/if}

		<!-- Score trend over last 30 days -->
		{#if trend && trend.points.length > 0}
			<div class="animate-fade-up delay-2">
				<ScoreTrendChart points={trend.points} summary={trend.summary} />
			</div>
		{/if}

		<!-- Filters -->
		<div class="filter-bar">
			<select bind:value={filterSection} class="select-premium">
				<option value="all">All sections</option>
				{#each sections as [name]}<option value={name}>{name}</option>{/each}
			</select>
			<select bind:value={filterStatus} class="select-premium">
				<option value="all">All statuses</option>
				<option value="pass">Pass</option>
				<option value="fail">Fail</option>
				<option value="partial">Partial</option>
			</select>
		</div>

		<!-- Controls table -->
		<div class="animate-fade-up delay-3">
			{#if isGated}
				<TrialGate plan={userPlan} feature="CIS controls" previewCount={cisLimit} totalCount={result.totalControls} requiredPlan="professional">
					{#snippet preview()}
						<ControlTable controls={previewControls} {filterSection} {filterStatus} />
					{/snippet}
				</TrialGate>
			{:else}
				<ControlTable controls={result.controls} {filterSection} {filterStatus} />
			{/if}
		</div>

		{#if result.scannedAt}
			<p style="font-size: 12px; color: var(--color-text-tertiary);">Last scan: {new Date(result.scannedAt).toLocaleString()}</p>
		{/if}
	{/if}
</div>
