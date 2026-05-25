<script lang="ts">
	import PurviewOverviewGrid from '$components/PurviewOverviewGrid.svelte';
	import PurviewFeatureCard from '$components/PurviewFeatureCard.svelte';
	import PurviewDlpTable from '$components/PurviewDlpTable.svelte';
	import PurviewLabelsTable from '$components/PurviewLabelsTable.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import { untrack } from 'svelte';

	interface PurviewData {
		overallScore: number;
		features: Feature[];
		dlpPolicies: DlpPolicy[];
		sensitivityLabels: SensitivityLabel[];
		summary: Summary;
	}
	interface Feature {
		category: string; name: string; description: string;
		status: 'configured' | 'partial' | 'not_configured' | 'disabled';
		severity: 'critical' | 'high' | 'medium' | 'low';
		details: { current: string; recommended: string; gap: string };
		regulations: string[]; remediationSteps: string[];
	}
	interface DlpPolicy {
		name: string; status: 'active' | 'test' | 'disabled' | 'not_created';
		sensitiveTypes: string[]; locations: string[]; actions: string[];
		matchCount: number; falsePositiveRate: number;
	}
	interface SensitivityLabel {
		name: string; scope: string; encryption: boolean;
		autoLabeling: boolean; usageCount: number;
	}
	interface Summary {
		totalFeatures: number; configured: number; partial: number;
		notConfigured: number; criticalGaps: number;
	}

	let data = $state<PurviewData | null>(null);
	let loading = $state(true);
	let rescanning = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if ($tenant.currentTenantId) untrack(() => loadPurview());
	});

	async function rescan() {
		rescanning = true;
		await loadPurview();
		rescanning = false;
		if (!error) toasts.success('Purview compliance re-scanned');
	}

	async function loadPurview() {
		loading = true;
		error = null;
		try {
			data = await api.get<PurviewData>(
				`/tenants/${$tenant.currentTenantId}/purview`,
			);
		} catch (err) {
			error = safeErrorMessage(err, 'Failed to load Purview data');
		} finally {
			loading = false;
		}
	}

	function handleExportCsv() {
		if (!data) return;
		const rows = data.features.map(f => ({ category: f.category, name: f.name, status: f.status, severity: f.severity, current: f.details.current, recommended: f.details.recommended, gap: f.details.gap }));
		exportCsv(rows, [
			{ key: 'category', label: 'Category' }, { key: 'name', label: 'Feature' },
			{ key: 'status', label: 'Status' }, { key: 'severity', label: 'Severity' },
			{ key: 'current', label: 'Current' }, { key: 'recommended', label: 'Recommended' },
			{ key: 'gap', label: 'Gap' },
		], 'compliance-purview');
		toasts.success('Compliance data exported as CSV');
	}

	function handleExportJson() {
		if (!data) return;
		exportJson(data, { type: 'compliance-purview' }, 'compliance-purview');
		toasts.success('Compliance data exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied to clipboard');
	}

	const hasData = $derived(data && (data.summary.totalFeatures > 0 || data.dlpPolicies.length > 0 || data.sensitivityLabels.length > 0));

	async function triggerSync() {
		if (!$tenant.currentTenantId) return;
		try {
			await api.post(`/tenants/${$tenant.currentTenantId}/sync`);
			toasts.success('Sync started — compliance data will appear shortly');
			setTimeout(() => loadPurview(), 3000);
		} catch { toasts.error('Failed to start sync'); }
	}

	const grouped = $derived.by(() => {
		if (!data) return new Map<string, Feature[]>();
		const map = new Map<string, Feature[]>();
		for (const f of data.features) {
			const list = map.get(f.category) ?? [];
			list.push(f);
			map.set(f.category, list);
		}
		return map;
	});
</script>

<svelte:head>
	<title>Purview Compliance | TenantIQ</title>
</svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Purview Compliance" description="DLP, sensitivity labels, and retention policies">
		<div class="flex items-center gap-2">
			{#if data}
				<button onclick={rescan} disabled={rescanning} class="btn-primary">
					{#if rescanning}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>{/if}
					Re-Scan
				</button>
			{/if}
			<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink} disabled={!data} />
		</div>
	</PageHeader>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _}
				<div class="h-24 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4">
			<p class="text-sm text-[var(--color-danger)]">{error}</p>
		</div>
	{:else if !hasData}
		<!-- Empty state — no compliance data -->
		<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
			<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
			</div>
			<h2 class="text-xl font-semibold text-[var(--color-text)]">Compliance data awaiting sync</h2>
			<p class="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
				Sync your tenant to scan Microsoft Purview features — DLP policies, sensitivity labels, retention rules, and regulatory compliance.
			</p>
			<div class="mx-auto mt-8 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each [
					{ name: 'DLP Policies', desc: 'Data loss prevention' },
					{ name: 'Labels', desc: 'Sensitivity classification' },
					{ name: 'Retention', desc: 'Data lifecycle rules' },
					{ name: 'Regulations', desc: 'GDPR, SOC 2, HIPAA' },
				] as item}
					<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center">
						<p class="text-xs font-medium text-[var(--color-text)]">{item.name}</p>
						<p class="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{item.desc}</p>
					</div>
				{/each}
			</div>
			<div class="mt-8 flex items-center justify-center gap-3">
				<button onclick={triggerSync} class="btn-primary">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
					Run Compliance Scan
				</button>
				<a href="/security" class="btn-secondary">Security Overview</a>
			</div>
		</div>

	{:else if data}
		<PurviewOverviewGrid features={data.features} overallScore={data.overallScore} dlpCount={data.dlpPolicies.length} labelCount={data.sensitivityLabels.length} />

		<!-- Feature details -->
		{#each [...grouped.entries()] as [category, features]}
			<section>
				<h2 class="mb-3 section-title">{category}</h2>
				<div class="space-y-2">
					{#each features as feature}<PurviewFeatureCard {feature} />{/each}
				</div>
			</section>
		{/each}

		{#if data.dlpPolicies.length > 0}<PurviewDlpTable policies={data.dlpPolicies} />{/if}
		{#if data.sensitivityLabels.length > 0}<PurviewLabelsTable labels={data.sensitivityLabels} />{/if}
	{/if}
</div>
