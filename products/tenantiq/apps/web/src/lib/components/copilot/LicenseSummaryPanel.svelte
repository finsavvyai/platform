<script lang="ts">
	interface Props {
		copilotLicensed: number;
		totalLicensed: number;
	}
	let { copilotLicensed, totalLicensed }: Props = $props();

	const adoptionPct = $derived(
		totalLicensed > 0 ? Math.round((copilotLicensed / totalLicensed) * 100) : 0
	);
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<p class="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
		Copilot License Coverage
	</p>
	<div class="mt-3 flex items-end gap-2">
		<span class="text-2xl font-bold text-[var(--color-text)]">{copilotLicensed}</span>
		<span class="mb-0.5 text-sm text-[var(--color-text-secondary)]">/ {totalLicensed} licensed users</span>
		<span class="mb-0.5 ml-auto text-sm font-semibold text-[var(--color-primary)]">{adoptionPct}%</span>
	</div>
	<div class="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
		<div
			class="h-full rounded-full bg-[var(--color-primary)]"
			style="width: {Math.min(adoptionPct, 100)}%"
		></div>
	</div>
	<p class="mt-2 text-xs text-[var(--color-text-tertiary)]">
		{#if adoptionPct < 50}
			Low adoption — consider a Copilot rollout plan.
		{:else if adoptionPct < 80}
			Growing adoption — continue rollout.
		{:else}
			Strong Copilot adoption across the tenant.
		{/if}
	</p>
</div>
