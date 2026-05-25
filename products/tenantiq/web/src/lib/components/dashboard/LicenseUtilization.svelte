<script lang="ts">
	import type { LicenseSkuBreakdown } from '$lib/types/shared';
	import { formatCurrency } from '$utils/format';

	interface Props {
		breakdown: LicenseSkuBreakdown[];
		utilization: number;
	}

	let { breakdown, utilization }: Props = $props();

	const sorted = $derived([...breakdown].sort((a, b) => b.total - a.total).slice(0, 8));

	function barPercent(assigned: number, total: number): number {
		return total > 0 ? Math.round((assigned / total) * 100) : 0;
	}

	function barColor(pct: number): string {
		if (pct >= 80) return 'var(--color-success)';
		if (pct >= 50) return 'var(--color-warning)';
		return 'var(--color-danger)';
	}

	function shortSku(name: string): string {
		return name.replace(/_/g, ' ').replace(/ENTERPRISEPACK/i, 'E3').replace(/SPE_E5/i, 'E5').replace(/EXCHANGESTANDARD/i, 'Exchange Online').replace(/FLOW_FREE/i, 'Power Automate').replace(/POWER_BI_STANDARD/i, 'Power BI Free').replace(/TEAMS_EXPLORATORY/i, 'Teams Trial');
	}
</script>

<section class="animate-fade-up delay-5">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-base font-semibold text-[var(--color-text)]">License Utilization</h2>
		<a href="/licenses" class="text-sm font-medium text-[var(--color-primary)] hover:underline">View all</a>
	</div>
	{#if sorted.length === 0}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
			<p class="text-sm text-[var(--color-text-secondary)]">No license data. Sync your tenant to see utilization.</p>
		</div>
	{:else}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<div class="mb-4 flex items-center gap-3">
				<span class="text-2xl font-bold text-[var(--color-text)]">{utilization}%</span>
				<span class="text-xs text-[var(--color-text-secondary)]">overall utilization</span>
			</div>
			<div class="space-y-3">
				{#each sorted as sku}
					{@const pct = barPercent(sku.assigned, sku.total)}
					<div>
						<div class="mb-1 flex items-center justify-between">
							<span class="truncate text-xs font-medium text-[var(--color-text)]">{shortSku(sku.skuName)}</span>
							<span class="ml-2 shrink-0 text-xs text-[var(--color-text-secondary)]">{sku.assigned}/{sku.total} ({formatCurrency(sku.costPerUnit)}/u)</span>
						</div>
						<div class="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
							<div class="h-full rounded-full transition-all duration-500" style="width: {pct}%; background: {barColor(pct)}"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</section>
