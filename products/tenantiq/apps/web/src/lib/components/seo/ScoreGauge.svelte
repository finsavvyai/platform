<script lang="ts">
	interface Props {
		score: number;
		label: string;
		size?: number;
		hero?: boolean;
	}

	let { score, label, size = 80, hero = false }: Props = $props();

	const radius = $derived((size - (hero ? 10 : 6)) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const offset = $derived(circumference - (score / 100) * circumference);
	const gradientId = $derived(`gauge-${label.replace(/\s/g, '-')}`);

	const grade = $derived(
		score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' :
		score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'
	);
	const gradeColor = $derived(
		score >= 80 ? 'var(--color-success)' :
		score >= 60 ? 'var(--color-warning)' :
		'var(--color-danger)'
	);
</script>

<div class="score-gauge" class:hero style="--gauge-size: {size}px;">
	<svg width={size} height={size} class="-rotate-90">
		<defs>
			<linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
				{#if score >= 80}
					<stop offset="0%" stop-color="#34C759" />
					<stop offset="100%" stop-color="#30D158" />
				{:else if score >= 60}
					<stop offset="0%" stop-color="#FF9500" />
					<stop offset="100%" stop-color="#FFD60A" />
				{:else}
					<stop offset="0%" stop-color="#FF3B30" />
					<stop offset="100%" stop-color="#FF6B6B" />
				{/if}
			</linearGradient>
		</defs>
		<circle
			cx={size / 2} cy={size / 2} r={radius}
			fill="none" stroke="var(--color-border-subtle)"
			stroke-width={hero ? 10 : 6}
		/>
		<circle
			cx={size / 2} cy={size / 2} r={radius}
			fill="none" stroke="url(#{gradientId})"
			stroke-width={hero ? 10 : 6}
			stroke-linecap="round"
			stroke-dasharray={circumference}
			stroke-dashoffset={offset}
			class="animate-draw-ring"
			style="--ring-circumference: {circumference}"
		/>
	</svg>
	<div class="gauge-center">
		{#if hero}
			<span class="gauge-score" style="font-size: {size * 0.28}px;">{score}</span>
			<span class="gauge-grade" style="color: {gradeColor};">{grade}</span>
		{:else}
			<span class="gauge-score-sm">{score}</span>
		{/if}
	</div>
	<p class="gauge-label">{label}</p>
</div>

<style>
	.score-gauge {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		position: relative;
	}
	.gauge-center {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--gauge-size);
		height: var(--gauge-size);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0;
	}
	.gauge-score {
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
	.gauge-score-sm {
		font-size: 18px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
	.gauge-grade {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		line-height: 1;
		margin-top: 2px;
	}
	.gauge-label {
		font-size: 11px;
		font-weight: 500;
		color: var(--color-text-secondary);
		letter-spacing: 0.01em;
		text-align: center;
		white-space: nowrap;
	}
</style>
