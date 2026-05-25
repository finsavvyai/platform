<script lang="ts">
	interface Props {
		score: number;
	}

	let { score }: Props = $props();

	const radius = 54;
	const circumference = 2 * Math.PI * radius;
	const offset = $derived(circumference - (score / 100) * circumference);

	const color = $derived(
		score >= 70 ? 'var(--color-success)'
		: score >= 40 ? 'var(--color-warning)'
		: 'var(--color-danger)'
	);

	const label = $derived(
		score >= 70 ? 'Good' : score >= 40 ? 'Needs Work' : 'Critical'
	);
</script>

<div class="flex flex-col items-center gap-2">
	<svg width="140" height="140" viewBox="0 0 128 128" aria-label="Compliance score {score} percent">
		<circle cx="64" cy="64" r={radius} fill="none" stroke="var(--color-border)" stroke-width="10" />
		<circle
			cx="64" cy="64" r={radius} fill="none"
			stroke={color} stroke-width="10" stroke-linecap="round"
			stroke-dasharray={circumference} stroke-dashoffset={offset}
			transform="rotate(-90 64 64)"
			class="transition-all duration-700"
		/>
		<text x="64" y="58" text-anchor="middle" fill="var(--color-text)" font-size="28" font-weight="700">
			{score}
		</text>
		<text x="64" y="78" text-anchor="middle" fill="var(--color-text-secondary)" font-size="12">
			/ 100
		</text>
	</svg>
	<span class="text-sm font-medium" style="color: {color}">{label}</span>
</div>
