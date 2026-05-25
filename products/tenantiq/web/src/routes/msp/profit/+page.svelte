<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import { auth } from '$stores/auth';
	import { api } from '$api/client';
	import { formatCurrency, formatNumber } from '$utils/format';
	import { exportCsv, exportJson, copyToClipboard } from '$utils/export';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$utils/safe-error';
	import { untrack } from 'svelte';

	interface TenantProfit {
		name: string; domain: string; cost: number;
		savings: number; margin: number; roi: number;
	}
	interface Totals {
		totalCost: number; totalSavings: number;
		totalMargin: number; avgRoi: number;
	}

	let tenants = $state<TenantProfit[]>([]);
	let totals = $state<Totals>({ totalCost: 0, totalSavings: 0, totalMargin: 0, avgRoi: 0 });
	let loading = $state(true);
	let error = $state('');

	$effect(() => { if ($auth.user) untrack(() => loadProfit()); });

	async function loadProfit() {
		loading = true;
		error = '';
		try {
			const data = await api.get<{ tenants: TenantProfit[]; totals: Totals }>('/msp-profit/overview');
			tenants = data.tenants;
			totals = data.totals;
		} catch (err: any) {
			error = safeErrorMessage(err, 'Failed to load profit data');
		} finally { loading = false; }
	}

	function roiColor(roi: number): string {
		if (roi >= 150) return 'var(--color-success)';
		if (roi >= 100) return 'var(--color-warning)';
		return 'var(--color-danger)';
	}

	function roiMultiplier(roi: number): string {
		return `${(roi / 100).toFixed(1)}x`;
	}

	function handleExportCsv() {
		const rows = tenants.map(t => ({
			name: t.name, domain: t.domain, savings: t.savings,
			cost: t.cost, margin: t.margin, roi: `${t.roi}%`,
		}));
		exportCsv(rows, [
			{ key: 'name', label: 'Tenant' }, { key: 'domain', label: 'Domain' },
			{ key: 'savings', label: 'Savings/mo' }, { key: 'cost', label: 'Cost/mo' },
			{ key: 'margin', label: 'Margin' }, { key: 'roi', label: 'ROI %' },
		], 'msp-profit');
		toasts.success('Profit report exported as CSV');
	}

	function handleExportJson() {
		exportJson({ tenants, totals } as any, { type: 'msp-profit' }, 'msp-profit');
		toasts.success('Profit report exported as JSON');
	}

	async function handleCopyLink() {
		const ok = await copyToClipboard(window.location.href);
		if (ok) toasts.success('Link copied');
	}
</script>

<svelte:head><title>MSP Profit Dashboard | TenantIQ</title></svelte:head>

<div class="space-y-6 animate-fade-up">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-text)]">MSP Profit Dashboard</h1>
			<p class="text-[var(--color-text-secondary)]">How TenantIQ impacts your bottom line</p>
		</div>
		<ExportMenu onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCopyLink={handleCopyLink}
			disabled={tenants.length === 0} label="Export Report" />
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each Array(4) as _}<div class="h-24 skeleton rounded-2xl border border-[var(--color-border)]"></div>{/each}
		</div>
		<div class="space-y-3">
			{#each Array(5) as _}<div class="h-14 skeleton rounded-xl"></div>{/each}
		</div>
	{:else if error}
		<div class="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-6 text-center">
			<p class="text-sm text-[var(--color-danger)]">{error}</p>
			<button class="mt-3 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white" onclick={loadProfit}>Retry</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<MetricCard title="Total Monthly Savings" value={formatCurrency(totals.totalSavings)} subtitle="From license waste detected" />
			<MetricCard title="TenantIQ Cost" value={formatCurrency(totals.totalCost)} subtitle="{tenants.length} managed tenants" />
			<MetricCard title="Net Margin" value={formatCurrency(totals.totalMargin)} subtitle={totals.totalMargin >= 0 ? 'Positive ROI' : 'Below break-even'} />
			<MetricCard title="Average ROI" value={roiMultiplier(totals.avgRoi)} subtitle="{totals.avgRoi}% return on investment" />
		</div>

		{#if tenants.length === 0}
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
				<p class="text-lg font-medium text-[var(--color-text)]">No tenants connected</p>
				<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Connect tenants to see your profit analysis.</p>
			</div>
		{:else}
			<div class="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
							<th class="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">Tenant</th>
							<th class="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">Savings</th>
							<th class="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">Cost</th>
							<th class="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">Margin</th>
							<th class="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">ROI</th>
						</tr>
					</thead>
					<tbody>
						{#each tenants as t}
							<tr class="border-b border-[var(--color-border)] last:border-0 transition-colors hover:bg-[var(--color-surface-secondary)]">
								<td class="px-4 py-3">
									<div class="font-medium text-[var(--color-text)]">{t.name}</div>
									<div class="text-xs text-[var(--color-text-tertiary)]">{t.domain}</div>
								</td>
								<td class="px-4 py-3 text-right font-medium text-[var(--color-success)]">{formatCurrency(t.savings)}</td>
								<td class="px-4 py-3 text-right text-[var(--color-text-secondary)]">{formatCurrency(t.cost)}</td>
								<td class="px-4 py-3 text-right font-medium" style="color: {roiColor(t.roi)}">{formatCurrency(t.margin)}</td>
								<td class="px-4 py-3 text-right">
									<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style="color: {roiColor(t.roi)}; background: {roiColor(t.roi)}15">
										{t.roi}%
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-center text-xs text-[var(--color-text-tertiary)]">
				Savings calculated from license waste detected, inactive users identified, and security incidents prevented.
			</p>
		{/if}
	{/if}
</div>
