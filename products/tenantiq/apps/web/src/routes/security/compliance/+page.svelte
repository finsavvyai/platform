<script lang="ts">
	import PageHeader from '$components/ui/PageHeader.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import ComplianceTrendChart from '$components/compliance/ComplianceTrendChart.svelte';
	import ControlTable from '$components/compliance/ControlTable.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { exportJson, copyToClipboard } from '$utils/export';

	interface ControlResult {
		id: string; name: string; framework: string;
		status: 'pass' | 'fail' | 'partial' | 'error';
		evidence: string; remediation?: string; errorMessage?: string;
	}
	interface Framework {
		framework: string; score: number; controls: ControlResult[];
		passCount: number; failCount: number; partialCount: number; errorCount: number;
	}
	interface FrameworksResp { success: boolean; data: { frameworks: Framework[] } }
	interface TrendPoint { date: string; score: number; assessmentsThatDay: number }
	interface TrendSummary {
		windowDays: number; assessmentCount: number;
		latestScore: number | null; earliestScore: number | null;
		scoreDelta: number; direction: 'improving' | 'regressing' | 'stable';
	}
	interface TrendResp { framework: string; points: TrendPoint[]; summary: TrendSummary }

	let loading = $state(true);
	let refreshing = $state(false);
	let frameworks = $state<Framework[]>([]);
	let selected = $state<string | null>(null);
	let trend = $state<TrendResp | null>(null);
	let trendLoading = $state(false);

	$effect(() => { if ($tenant.currentTenantId) loadFrameworks(); });
	$effect(() => { if (selected) loadTrend(selected); });

	async function loadFrameworks() {
		loading = true;
		try {
			const res = await api.get<FrameworksResp>('/compliance-posture/frameworks');
			frameworks = res.data?.frameworks ?? [];
			if (frameworks.length && !selected) selected = frameworks[0].framework;
		} catch { frameworks = []; }
		finally { loading = false; }
	}

	async function loadTrend(framework: string) {
		trendLoading = true;
		try {
			trend = await api.get<TrendResp>(`/compliance-posture/trend?framework=${encodeURIComponent(framework)}&days=30`);
		} catch { trend = null; }
		finally { trendLoading = false; }
	}

	async function refresh() {
		refreshing = true;
		await loadFrameworks();
		if (selected) await loadTrend(selected);
		refreshing = false;
		toasts.success('Compliance refreshed');
	}

	function handleExportJson() {
		if (!frameworks.length) return;
		exportJson({ frameworks, trend }, { type: 'compliance-posture' }, 'compliance-posture');
		toasts.success('Compliance exported');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied');
	}

	const expanded = $derived(frameworks.find(f => f.framework === selected) ?? null);
	const hasData = $derived(frameworks.length > 0);
</script>

<svelte:head><title>Compliance | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Compliance Frameworks" description="SOC 2, HIPAA, GDPR, and ISO 27001 — with score trend & AI explainer" iconPath="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z">
		{#if hasData}
			<button onclick={refresh} disabled={refreshing} class="btn-primary">
				{#if refreshing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>{/if}
				Refresh
			</button>
			<ExportMenu onExportJson={handleExportJson} onCopyLink={handleCopyLink} />
		{/if}
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each Array(4) as _}
				<div class="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>
			{/each}
		</div>

	{:else if !hasData}
		<div class="empty-state">
			<h2 class="text-xl font-semibold text-[var(--color-text)]">No compliance data yet</h2>
			<p class="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
				Sync your tenant to assess compliance against SOC 2, HIPAA, GDPR, and ISO 27001.
			</p>
			<a href="/" class="btn-primary mt-8 inline-flex">Go to Dashboard</a>
		</div>

	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each frameworks as fw, i}
				<button
					onclick={() => { selected = fw.framework; }}
					class="animate-fade-up text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all duration-200 hover:shadow-[var(--shadow-md)] min-h-[44px] {selected === fw.framework ? 'ring-2 ring-[var(--color-primary)]' : ''}"
					style="animation-delay: {i * 60}ms"
				>
					<div class="flex items-center gap-4">
						<ScoreRing score={fw.score} size={64} strokeWidth={5} label="/100" />
						<div class="flex-1 min-w-0">
							<p class="text-sm font-semibold text-[var(--color-text)] truncate">{fw.framework}</p>
							<div class="mt-2 flex flex-wrap gap-2 text-xs">
								<span class="text-[var(--color-success)]">{fw.passCount} pass</span>
								<span class="text-[var(--color-danger)]">{fw.failCount} fail</span>
								<span class="text-[var(--color-warning)]">{fw.partialCount} partial</span>
								{#if fw.errorCount > 0}<span class="text-[var(--color-text-secondary)]">{fw.errorCount} N/A</span>{/if}
							</div>
						</div>
					</div>
					<p class="mt-3 text-xs text-[var(--color-text-tertiary)]">
						<span class="tabular-nums">{fw.controls.length}</span> controls assessed
					</p>
				</button>
			{/each}
		</div>

		{#if expanded}
			{#if trendLoading}
				<div class="h-48 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>
			{:else if trend}
				<ComplianceTrendChart framework={trend.framework} points={trend.points} summary={trend.summary} />
			{/if}

			<div class="panel animate-fade-up overflow-hidden">
				<div class="panel-header">
					<div>
						<h2 class="panel-title">{expanded.framework}</h2>
						<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">
							{expanded.controls.length} controls · click a row for AI explainer
						</p>
					</div>
				</div>
				<ControlTable framework={expanded.framework} controls={expanded.controls} />
			</div>
		{/if}
	{/if}
</div>
