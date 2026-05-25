<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { untrack } from 'svelte';

	interface MetricDef { id: string; name: string; category: string; type: string }
	interface Widget { metricId: string; name: string; type: string; category: string; value: number }
	interface ReportData { title: string; period: string; generatedAt: string; widgets: Widget[] }

	const PERIODS = [
		{ value: '7d', label: '7 Days' },
		{ value: '30d', label: '30 Days' },
		{ value: '90d', label: '90 Days' },
		{ value: '1y', label: '1 Year' },
	] as const;

	let metrics = $state<MetricDef[]>([]);
	let selected = $state<Set<string>>(new Set());
	let period = $state<string>('30d');
	let reportTitle = $state('Custom Report');
	let report = $state<ReportData | null>(null);
	let loading = $state(true);
	let generating = $state(false);
	let saving = $state(false);

	const tid = $derived($tenant.currentTenantId);
	const categories = $derived(groupByCategory(metrics));
	const hasSelection = $derived(selected.size > 0);

	$effect(() => { if (tid) untrack(() => loadMetrics()); else loading = false; });

	async function loadMetrics() {
		loading = true;
		try {
			const res = await api.get<{ metrics: MetricDef[] }>('/report-builder/metrics');
			metrics = res.metrics;
		} catch { toasts.error('Failed to load metrics'); }
		finally { loading = false; }
	}

	function groupByCategory(items: MetricDef[]): Record<string, MetricDef[]> {
		const groups: Record<string, MetricDef[]> = {};
		for (const m of items) {
			(groups[m.category] ??= []).push(m);
		}
		return groups;
	}

	function toggleMetric(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id); else next.add(id);
		selected = next;
	}

	async function generate() {
		if (!hasSelection) return;
		generating = true;
		try {
			report = await api.post<ReportData>('/report-builder/generate', {
				metrics: [...selected], period, title: reportTitle,
			});
			toasts.success('Report generated');
		} catch { toasts.error('Failed to generate report'); }
		finally { generating = false; }
	}

	async function saveTemplate() {
		if (!hasSelection) return;
		saving = true;
		try {
			await api.post('/report-builder/templates', {
				name: reportTitle, metrics: [...selected], period, layout: 'grid',
			});
			toasts.success('Template saved');
		} catch { toasts.error('Failed to save template'); }
		finally { saving = false; }
	}

	function formatValue(widget: Widget): string {
		if (widget.type === 'currency') return `$${widget.value.toLocaleString()}`;
		if (widget.type === 'percentage') return `${widget.value}%`;
		return String(widget.value);
	}

	function handleExportJson() {
		if (!report) return;
		const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = `report-${report.period}.json`; a.click();
		URL.revokeObjectURL(url);
		toasts.success('Exported as JSON');
	}

	function handleExportPdf() { window.print(); }
</script>

<svelte:head><title>Report Builder | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div class="animate-fade-up flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-text)]">Report Builder</h1>
			<p class="text-[var(--color-text-secondary)]">Select metrics and generate custom reports</p>
		</div>
		<div class="flex items-center gap-2">
			{#if report}<ExportMenu onExportJson={handleExportJson} onExportPdf={handleExportPdf} />{/if}
			<button onclick={saveTemplate} disabled={!hasSelection || saving} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-200 hover:shadow-[var(--shadow-sm)] disabled:opacity-50">
				{saving ? 'Saving...' : 'Save Template'}
			</button>
			<button onclick={generate} disabled={!hasSelection || generating} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)] disabled:opacity-50">
				{#if generating}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Generating...{:else}Generate Report{/if}
			</button>
		</div>
	</div>

	<!-- Period selector + title input -->
	<div class="animate-fade-up delay-1 flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
		<input bind:value={reportTitle} placeholder="Report title" class="min-h-[44px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
		<div class="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
			{#each PERIODS as p}
				<button onclick={() => (period = p.value)} class="min-h-[44px] px-4 py-2 text-sm font-medium transition-colors {period === p.value ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'}">{p.label}</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#each Array(6) as _}<div class="h-20 skeleton rounded-2xl"></div>{/each}
		</div>
	{:else}
		<div class="animate-fade-up delay-2 flex gap-6">
			<!-- Metric picker -->
			<div class="w-72 shrink-0 space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<h2 class="text-sm font-semibold text-[var(--color-text)]">Metrics</h2>
				{#each Object.entries(categories) as [cat, items]}
					<div>
						<p class="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">{cat}</p>
						{#each items as m}
							<label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-secondary)]">
								<input type="checkbox" checked={selected.has(m.id)} onchange={() => toggleMetric(m.id)} class="rounded" />
								{m.name}
							</label>
						{/each}
					</div>
				{/each}
			</div>

			<!-- Report output -->
			<div class="flex-1">
				{#if report}
					<div class="space-y-4">
						<p class="text-xs text-[var(--color-text-tertiary)]">Generated: {new Date(report.generatedAt).toLocaleString()}</p>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#each report.widgets as widget}
								<MetricCard title={widget.name} value={formatValue(widget)} subtitle={widget.category} />
							{/each}
						</div>
					</div>
				{:else if hasSelection}
					<div class="flex h-64 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)]">
						<div class="text-center">
							<p class="text-sm font-medium text-[var(--color-text-secondary)]">{selected.size} metric{selected.size > 1 ? 's' : ''} selected</p>
							<p class="mt-1 text-xs text-[var(--color-text-tertiary)]">Click "Generate Report" to fetch data</p>
						</div>
					</div>
				{:else}
					<div class="flex h-64 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)]">
						<p class="text-sm text-[var(--color-text-tertiary)]">Select metrics from the left panel to build your report</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
