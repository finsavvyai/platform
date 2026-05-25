<script lang="ts">
	import ReadinessOverview from '$lib/components/copilot/ReadinessOverview.svelte';
	import CategoryCard from '$lib/components/copilot/CategoryCard.svelte';
	import RecommendationList from '$lib/components/copilot/RecommendationList.svelte';
	import ReadinessHistory from '$lib/components/copilot/ReadinessHistory.svelte';
	import OversharingPanel from '$lib/components/copilot/OversharingPanel.svelte';
	import LicenseSummaryPanel from '$lib/components/copilot/LicenseSummaryPanel.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { tenant } from '$stores/tenant';

	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { exportJson, copyToClipboard } from '$utils/export';
	import { untrack } from 'svelte';

	interface Check { name: string; status: 'pass' | 'fail' | 'warning' | 'error'; detail: string; errorMessage?: string }
	interface CategoryResult { score: number; checks: Check[] }
	interface Recommendation { category: string; priority: 'critical' | 'high' | 'medium' | 'low'; title: string; description: string }
	interface Result {
		overallScore: number | null;
		categories: Record<string, CategoryResult> | null;
		recommendations: Recommendation[];
		assessedAt?: string;
	}
	interface HistoryEntry { id: string; score: number; categoryScores: Record<string, number>; assessedAt: string }
	interface LicenseSummary { copilotLicensed: number; totalLicensed: number; overshareRiskCount: number; labelGapCount: number }

	const CATEGORY_LABELS: Record<string, string> = {
		licensing: 'Licensing', identityAccess: 'Identity & Access', dataProtection: 'Data Protection',
		compliance: 'Compliance', security: 'Security', collaboration: 'Collaboration', dataQuality: 'Data Quality',
	};

	let result = $state<Result | null>(null);
	let history = $state<HistoryEntry[]>([]);
	let licenseSummary = $state<LicenseSummary | null>(null);
	let loading = $state(true);
	let assessing = $state(false);
	let assessmentId = $state<string | null>(null);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadData()); });

	async function loadData() {
		loading = true;
		try {
			const [latest, hist, summary] = await Promise.all([
				api.get<Result>('/copilot-readiness/latest').catch(() => null),
				api.get<HistoryEntry[]>('/copilot-readiness/history').catch(() => []),
				api.get<LicenseSummary>('/copilot-readiness/license-summary').catch(() => null),
			]);
			result = latest;
			history = hist;
			licenseSummary = summary;
			if (hist.length > 0) assessmentId = hist[0].id;
		} finally { loading = false; }
	}

	async function runAssessment() {
		assessing = true;
		try {
			const res = await api.post<{ success: boolean; result: Result; assessmentId?: string; error?: string }>('/copilot-readiness/assess');
			if (res.error) toasts.error(res.error);
			else {
				result = res.result;
				if (res.assessmentId) assessmentId = res.assessmentId;
				toasts.success(`Copilot readiness: ${res.result.overallScore}%`);
				history = await api.get<HistoryEntry[]>('/copilot-readiness/history').catch(() => history);
			}
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Assessment failed'); }
		finally { assessing = false; }
	}

	function handleExportJson() {
		if (!result) return;
		exportJson([result], { type: 'copilot-readiness' }, 'copilot-readiness');
		toasts.success('Assessment exported as JSON');
	}

	async function handleExportPdf() {
		try {
			const endpoint = assessmentId
				? `/copilot-readiness/${assessmentId}/pdf`
				: '/copilot-readiness/export';
			const html = await api.get<string>(endpoint);
			const blob = new Blob([html as any], { type: 'text/html' });
			const url = URL.createObjectURL(blob);
			window.open(url, '_blank');
			toasts.success('Report opened — use browser Print to save as PDF');
		} catch { toasts.error('Export failed'); }
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied');
	}

	const categories = $derived(
		result?.categories ? Object.entries(result.categories).map(([key, val]) => ({ key, label: CATEGORY_LABELS[key] ?? key, ...val })) : [],
	);
	const hasData = $derived(result?.overallScore != null);
	const btnLabel = $derived(assessing ? 'Assessing...' : hasData ? 'Re-Run Assessment' : 'Run Assessment');
</script>

<svelte:head><title>Copilot Readiness | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Copilot Readiness" description="7-category assessment for Microsoft 365 Copilot deployment">
		<div class="flex items-center gap-2">
			{#if hasData}
				<ExportMenu onExportJson={handleExportJson} onExportPdf={handleExportPdf} onCopyLink={handleCopyLink} />
			{/if}
			<button onclick={runAssessment} disabled={assessing} class="btn-primary">
				{#if assessing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>{/if}
				{btnLabel}
			</button>
		</div>
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(8) as _, i}<div class="h-28 skeleton rounded-2xl delay-{i + 1}"></div>{/each}
		</div>
	{:else if !hasData}
		<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
			<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
			</div>
			<h2 class="text-xl font-semibold text-[var(--color-text)]">Is your tenant ready for Copilot?</h2>
			<p class="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">Evaluate licensing, identity, data protection, compliance, security, collaboration, and data quality across 7 categories.</p>
			<div class="mx-auto mt-6 grid max-w-2xl grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
				{#each Object.values(CATEGORY_LABELS) as label}
					<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-center">
						<p class="text-[10px] font-medium text-[var(--color-text)]">{label}</p>
					</div>
				{/each}
			</div>
			<button onclick={runAssessment} disabled={assessing} class="btn-primary mt-8">
				{#if assessing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>{/if}
				Run First Assessment
			</button>
		</div>
	{:else}
		<div class="animate-fade-up delay-1 grid grid-cols-1 gap-4 sm:grid-cols-4">
			<ReadinessOverview score={result?.overallScore ?? 0} />
			{#each categories as cat, i}
				<CategoryCard label={cat.label} score={cat.score} checks={cat.checks} index={i} />
			{/each}
		</div>

		<ReadinessHistory {history} />

		{#if licenseSummary}
			<OversharingPanel
				overshareRiskCount={licenseSummary.overshareRiskCount}
				labelGapCount={licenseSummary.labelGapCount}
			/>
			<LicenseSummaryPanel
				copilotLicensed={licenseSummary.copilotLicensed}
				totalLicensed={licenseSummary.totalLicensed}
			/>
		{/if}

		{#if result?.recommendations?.length}
			<RecommendationList recommendations={result.recommendations} />
		{/if}

		{#if result?.assessedAt}
			<p class="text-xs text-[var(--color-text-tertiary)]">Assessed: {new Date(result.assessedAt).toLocaleString()}</p>
		{/if}
	{/if}
</div>
