<script lang="ts">
	interface Props {
		totalValue: number;
		thirdPartyEquivalent: number;
	}

	let { totalValue, thirdPartyEquivalent }: Props = $props();

	const monthlySavings = $derived(thirdPartyEquivalent - (totalValue > 0 ? totalValue : 0));
	const yearlySavings = $derived(monthlySavings * 12);

	const formatCurrency = (num: number) => {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
	};

	const percentSaved = $derived(totalValue > 0 ? Math.round((monthlySavings / thirdPartyEquivalent) * 100) : 0);
</script>

<div class="animate-fade-up relative overflow-hidden rounded-2xl border border-[var(--color-primary)]/30 bg-gradient-to-r from-[var(--color-primary)]/5 to-[var(--color-primary)]/10 px-6 py-8">
	<!-- Decorative background elements -->
	<div class="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-[var(--color-primary)]/5 blur-3xl"></div>
	<div class="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-[var(--color-accent)]/5 blur-3xl"></div>

	<div class="relative space-y-4">
		<div class="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
			<!-- Left: Value card -->
			<div class="flex-1">
				<p class="text-sm font-medium text-[var(--color-text-secondary)]">Your Microsoft 365 Security Value</p>
				<p class="mt-2 text-3xl font-bold text-[var(--color-primary)]">
					{formatCurrency(totalValue)}/mo
				</p>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Built-in security features</p>
			</div>

			<!-- Middle: Savings indicator -->
			<div class="flex items-center justify-center">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
				</svg>
			</div>

			<!-- Right: Third-party equivalent -->
			<div class="flex-1 text-right">
				<p class="text-sm font-medium text-[var(--color-text-secondary)]">Equivalent Third-Party Cost</p>
				<p class="mt-2 text-3xl font-bold text-[var(--color-danger)]">
					{formatCurrency(thirdPartyEquivalent)}/mo
				</p>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Cisco, Proofpoint, etc.</p>
			</div>
		</div>

		{#if monthlySavings > 0}
			<!-- Savings summary -->
			<div class="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 px-4 py-3">
				<div class="flex items-center justify-between gap-4 sm:flex-col sm:items-start">
					<div>
						<p class="text-sm font-medium text-[var(--color-success)]">Potential Monthly Savings</p>
						<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">If configured optimally</p>
					</div>
					<div class="flex flex-col items-end gap-1 sm:items-start">
						<p class="text-xl font-bold text-[var(--color-success)]">{formatCurrency(monthlySavings)}</p>
						<p class="text-xs text-[var(--color-text-secondary)]">{formatCurrency(yearlySavings)}/year</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Info text -->
		<p class="text-xs text-[var(--color-text-secondary)]">
			These values are based on typical Microsoft 365 licensing and industry-standard equivalent tools. Actual savings depend on your specific configuration and feature usage.
		</p>
	</div>
</div>
