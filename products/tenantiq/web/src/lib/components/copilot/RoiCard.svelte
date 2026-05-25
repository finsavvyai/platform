<script lang="ts">
	interface Props {
		monthlyCost: number;
		monthlyProductivityValue: number;
		netRoi: number;
		roiPercentage: number;
		hoursSavedPerMonth: number;
	}

	let { monthlyCost, monthlyProductivityValue, netRoi, roiPercentage, hoursSavedPerMonth }: Props = $props();

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
	}

	const roiPositive = $derived(netRoi >= 0);
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h3 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Copilot ROI Analysis</h3>
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-5">
		<div class="text-center">
			<p class="text-xs text-[var(--color-text-secondary)]">Monthly Cost</p>
			<p class="mt-1 text-lg font-bold text-[var(--color-text)]">{formatCurrency(monthlyCost)}</p>
		</div>
		<div class="text-center">
			<p class="text-xs text-[var(--color-text-secondary)]">Productivity Value</p>
			<p class="mt-1 text-lg font-bold text-[var(--color-success)]">{formatCurrency(monthlyProductivityValue)}</p>
		</div>
		<div class="text-center">
			<p class="text-xs text-[var(--color-text-secondary)]">Net ROI</p>
			<p class="mt-1 text-lg font-bold" class:text-[var(--color-success)]={roiPositive} class:text-[var(--color-error)]={!roiPositive}>
				{formatCurrency(netRoi)}
			</p>
		</div>
		<div class="text-center">
			<p class="text-xs text-[var(--color-text-secondary)]">ROI %</p>
			<p class="mt-1 text-lg font-bold" class:text-[var(--color-success)]={roiPositive} class:text-[var(--color-error)]={!roiPositive}>
				{roiPercentage}%
			</p>
		</div>
		<div class="text-center">
			<p class="text-xs text-[var(--color-text-secondary)]">Hours Saved/mo</p>
			<p class="mt-1 text-lg font-bold text-[var(--color-primary)]">{hoursSavedPerMonth}</p>
		</div>
	</div>
</div>
