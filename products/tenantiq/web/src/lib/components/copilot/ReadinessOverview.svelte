<script lang="ts">
	import ScoreRing from '$components/ScoreRing.svelte';

	interface Props {
		score: number;
	}

	let { score }: Props = $props();

	const label = $derived(
		score >= 70 ? 'Ready' : score >= 40 ? 'Needs Work' : 'Not Ready',
	);
	const labelColor = $derived(
		score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-danger)',
	);
</script>

<div class="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5" data-testid="readiness-score">
	<ScoreRing {score} size={96} strokeWidth={7} label="/100" />
	<p class="mt-2 text-xs font-semibold" style="color: {labelColor}">{label}</p>
	<p class="mt-1 text-[10px] text-[var(--color-text-tertiary)]">Overall Readiness</p>
</div>
