<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { untrack } from 'svelte';

	interface ReportKPI { label: string; value: string; change?: number; changeDirection: string; isPositive: boolean; icon: string }
	interface ReportSection { title: string; icon: string; summary: string; kpis: ReportKPI[]; highlights: string[]; risks: string[] }
	interface ReportAction { priority: string; title: string; description: string; estimatedSavings?: number }
	interface FinancialSummary { totalSpend: number; wastedSpend: number; savingsRealized: number; projectedSavings: number; costPerUser: number; roi: number }
	interface ExecutiveReport {
		id: string; title: string; subtitle: string; generatedAt: string; period: string;
		executiveSummary: string; overallGrade: string; overallScore: number;
		sections: ReportSection[]; keyActions: ReportAction[];
		financialSummary?: FinancialSummary; benchmarkSummary: string;
		htmlEmail: string; shareToken: string;
	}
	interface Report {
		summary: string; generatedAt: string; period: string;
		metrics: { totalUsers: number; licensedUsers: number; securityScore: number; compliancePct: number; monthlyCost: number };
		recommendations: { priority: string; title: string; impact: string }[];
		emailHtml?: string; overallGrade?: string; sections?: ReportSection[];
		financialSummary?: FinancialSummary; benchmarkSummary?: string;
	}

	let report = $state<Report | null>(null);
	let loading = $state(true);
	let generating = $state(false);
	let previewHtml = $state<string | null>(null);
	let period = $state<'weekly' | 'monthly' | 'quarterly'>('monthly');
	let includeSecurity = $state(true);
	let includeFinancials = $state(true);
	let includeCompliance = $state(true);
	let includeRecommendations = $state(true);

	const tid = $derived($tenant.currentTenantId);
	const config = $derived({ reportPeriod: period, includeSecurity, includeFinancials, includeCompliance, includeRecommendations });
	const hasData = $derived(report !== null);

	$effect(() => { if (tid) untrack(() => generate(true)); else loading = false; });

	async function generate(initial = false) {
		if (initial) loading = true; else generating = true;
		try {
			const res = await api.post<{ success: boolean; data: ExecutiveReport; timestamp: string }>('/executive-report/generate', config);
			const d = res.data;
			// Extract key metrics from sections
			const secSection = d.sections?.find(s => s.title.toLowerCase().includes('security'));
			const secScore = secSection?.kpis?.find(k => k.label.toLowerCase().includes('score'));
			const compSection = d.sections?.find(s => s.title.toLowerCase().includes('compliance'));
			const compKpi = compSection?.kpis?.find(k => k.label.toLowerCase().includes('compliance'));
			const finSection = d.sections?.find(s => s.title.toLowerCase().includes('financial'));
			const costKpi = finSection?.kpis?.find(k => k.label.toLowerCase().includes('spend') || k.label.toLowerCase().includes('cost'));
			const allKpis = d.sections?.flatMap(s => s.kpis) ?? [];
			const totalUsersKpi = allKpis.find(k => {
				const l = k.label.toLowerCase();
				return l.includes('total user') || l.includes('active user') || (l.includes('user') && !l.includes('licens'));
			});
			const licensedKpi = allKpis.find(k => k.label.toLowerCase().includes('licens'));
			const parseCount = (v: string | undefined): number =>
				Math.max(0, Math.round(parseFloat((v ?? '').replace(/[^0-9.]/g, '')) || 0));

			report = {
				summary: d.executiveSummary,
				generatedAt: d.generatedAt,
				period: d.period,
				metrics: {
					totalUsers: parseCount(totalUsersKpi?.value),
					licensedUsers: parseCount(licensedKpi?.value),
					securityScore: d.overallScore || parseInt(secScore?.value?.replace(/[^0-9]/g, '') || '0') || 0,
					compliancePct: Math.max(0, Math.min(100, Math.round(
						parseFloat((compKpi?.value ?? '').replace(/[^0-9.]/g, '')) || d.overallScore || 0
					))),
					monthlyCost: d.financialSummary?.totalSpend ?? (parseFloat(costKpi?.value?.replace(/[^0-9.]/g, '') || '0') || 0),
				},
				recommendations: (d.keyActions || []).map(a => ({ priority: a.priority, title: a.title, impact: a.description })),
				emailHtml: d.htmlEmail,
				overallGrade: d.overallGrade,
				sections: d.sections,
				financialSummary: d.financialSummary,
				benchmarkSummary: d.benchmarkSummary,
			};
			if (!initial) toasts.success('Report generated');
		} catch (err) { report = null; if (!initial) toasts.error('Failed to generate report'); console.error('[Report]', err); }
		finally { loading = false; generating = false; }
	}

	function previewEmail() {
		if (report?.emailHtml) previewHtml = report.emailHtml;
		else toasts.info('No email preview available');
	}

	function handleExportJson() {
		if (!report) return;
		const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = `executive-report-${report.period}.json`; a.click();
		URL.revokeObjectURL(url);
		toasts.success('Report exported as JSON');
	}

	function handleExportCsv() {
		if (!report) return;
		const m = report.metrics;
		const rows = [['Metric', 'Value'], ['Total Users', String(m.totalUsers)], ['Licensed Users', String(m.licensedUsers)],
			['Security Score', String(m.securityScore)], ['Compliance', `${m.compliancePct}%`], ['Monthly Cost', `$${m.monthlyCost}`]];
		const csv = rows.map(r => r.join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = `executive-report-${report.period}.csv`; a.click();
		URL.revokeObjectURL(url);
		toasts.success('Report exported as CSV');
	}

	let exportingPdf = $state(false);

	async function handleExportPdf() {
		exportingPdf = true;
		try {
			const html = await api.get<string>('/executive-report/pdf-preview');
			const win = window.open('', '_blank');
			if (win) {
				win.document.write(html as unknown as string);
				win.document.close();
			} else {
				toasts.error('Pop-up blocked. Please allow pop-ups for this site.');
			}
		} catch {
			toasts.error('Failed to generate PDF preview');
		} finally {
			exportingPdf = false;
		}
	}
</script>

<svelte:head><title>Executive Report | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Executive Reports" description="High-level security, compliance, and cost summary for stakeholders">
		<div class="flex items-center gap-2">
			{#if hasData}
				<button onclick={handleExportPdf} disabled={exportingPdf} class="btn-secondary">
					{#if exportingPdf}<span class="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"></span>{/if}
					Export PDF
				</button>
				<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} />
			{/if}
			<button onclick={() => generate()} disabled={generating} class="btn-primary">
				{#if generating}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Generating...{:else}Generate Report{/if}
			</button>
		</div>
	</PageHeader>

	<div class="filter-bar flex-wrap rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
		<select bind:value={period} class="select-premium">
			<option value="weekly">Weekly</option>
			<option value="monthly">Monthly</option>
			<option value="quarterly">Quarterly</option>
		</select>
		<label class="flex items-center gap-2 text-sm text-[var(--color-text)]"><input type="checkbox" bind:checked={includeSecurity} class="rounded" /> Security</label>
		<label class="flex items-center gap-2 text-sm text-[var(--color-text)]"><input type="checkbox" bind:checked={includeFinancials} class="rounded" /> Financials</label>
		<label class="flex items-center gap-2 text-sm text-[var(--color-text)]"><input type="checkbox" bind:checked={includeCompliance} class="rounded" /> Compliance</label>
		<label class="flex items-center gap-2 text-sm text-[var(--color-text)]"><input type="checkbox" bind:checked={includeRecommendations} class="rounded" /> Recommendations</label>
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _}<div class="h-28 skeleton rounded-2xl"></div>{/each}
		</div>
		<div class="h-40 skeleton rounded-2xl"></div>
	{:else if !hasData}
		<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
			<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
			</div>
			<h2 class="text-xl font-semibold text-[var(--color-text)]">No Report Generated</h2>
			<p class="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">Generate an executive summary of your Microsoft 365 tenant's security posture, compliance status, and cost breakdown.</p>
			<button onclick={() => generate()} class="btn-primary mt-6">Generate First Report</button>
		</div>
	{:else if report}
		<div class="animate-fade-up delay-1 grid grid-cols-1 gap-4 sm:grid-cols-5">
			<div class="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<ScoreRing score={report.metrics.securityScore} size={96} strokeWidth={7} label="/100" />
				<p class="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">Security Score</p>
			</div>
			<MetricCard title="Total Users" value={String(report.metrics.totalUsers)} subtitle="Active accounts" />
			<MetricCard title="Licensed Users" value={String(report.metrics.licensedUsers)} subtitle="Assigned licenses" />
			<MetricCard title="Compliance" value={`${report.metrics.compliancePct}%`} subtitle="Policy adherence" />
			<MetricCard title="Monthly Cost" value={`$${report.metrics.monthlyCost.toLocaleString()}`} subtitle="License spend" />
		</div>

		<div class="animate-fade-up delay-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
			<h2 class="mb-3 section-title">Executive Summary</h2>
			<p class="whitespace-pre-line text-sm leading-relaxed text-[var(--color-text-secondary)]">{report.summary}</p>
		</div>

		{#if includeRecommendations && report.recommendations.length > 0}
			<div class="animate-fade-up delay-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
				<h2 class="mb-3 section-title">Recommendations</h2>
				<div class="space-y-3">
					{#each report.recommendations as rec}
						<div class="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
							<span class="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full" class:bg-red-500={rec.priority === 'high'} class:bg-yellow-500={rec.priority === 'medium'} class:bg-green-500={rec.priority === 'low'}></span>
							<div><p class="text-sm font-medium text-[var(--color-text)]">{rec.title}</p><p class="mt-1 text-xs text-[var(--color-text-secondary)]">{rec.impact}</p></div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="flex items-center justify-between">
			<p class="text-xs text-[var(--color-text-tertiary)]">Generated: {new Date(report.generatedAt).toLocaleString()}</p>
			<button onclick={previewEmail} class="min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)]">Preview Email</button>
		</div>
	{/if}
</div>

{#if previewHtml}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" role="dialog" aria-modal="true">
		<div class="relative max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl bg-[var(--color-surface)] p-6 shadow-xl">
			<button onclick={() => (previewHtml = null)} class="absolute right-4 top-4 min-h-[44px] min-w-[44px] rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" aria-label="Close preview">&times;</button>
			<!-- Sandbox neutralises any script or navigation in the generated email HTML. -->
			<iframe
				title="Report preview"
				srcdoc={previewHtml}
				sandbox=""
				referrerpolicy="no-referrer"
				class="h-[60vh] w-full rounded-xl border border-[var(--color-border)] bg-white"
			></iframe>
		</div>
	</div>
{/if}
