<script lang="ts">
	interface Props {
		usedGB: number;
		allocatedGB: number;
		pct: number;
		label?: string;
	}

	let { usedGB, allocatedGB, pct, label }: Props = $props();

	const barColor = $derived(
		pct > 85 ? 'var(--color-danger)' : pct > 60 ? 'var(--color-warning)' : 'var(--color-primary)'
	);
</script>

<div class="space-y-2">
	{#if label}
		<p class="text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
	{/if}
	<div class="flex items-baseline justify-between">
		<span class="text-2xl font-semibold text-[var(--color-text)]">{usedGB} GB</span>
		<span class="text-sm text-[var(--color-text-secondary)]">of {allocatedGB} GB</span>
	</div>
	<div class="h-3 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
		<div
			class="h-full rounded-full transition-all duration-500 ease-out"
			style="width: {Math.min(pct, 100)}%; background: {barColor}"
			role="progressbar"
			aria-valuenow={pct}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label="Storage usage {pct}%"
		></div>
	</div>
	<p class="text-right text-xs text-[var(--color-text-secondary)]">{pct}% utilized</p>
</div>
