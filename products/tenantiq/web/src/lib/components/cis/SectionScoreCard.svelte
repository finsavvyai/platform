<script lang="ts">
	interface Props {
		section: string;
		score: number;
		pass: number;
		fail: number;
		total: number;
	}

	let { section, score, pass, fail, total }: Props = $props();

	const color = $derived(score >= 80 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)');
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex items-center justify-between">
		<p class="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{section}</p>
		<span class="text-lg font-bold" style="color: {color}">{score}%</span>
	</div>
	<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
		<div class="h-full rounded-full animate-fill-bar" style="width: {score}%; background: {color}"></div>
	</div>
	<div class="mt-2 flex justify-between text-[11px] text-[var(--color-text-secondary)]">
		<span>{pass} pass</span>
		<span>{fail} fail</span>
		<span>{total} total</span>
	</div>
</div>
