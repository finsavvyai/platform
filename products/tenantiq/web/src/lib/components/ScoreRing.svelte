<script lang="ts">
	interface Props {
		score: number;
		size?: number;
		strokeWidth?: number;
		label?: string;
	}

	let { score, size = 120, strokeWidth = 8, label = 'Score' }: Props = $props();

	const radius = $derived((size - strokeWidth) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const offset = $derived(circumference - (score / 100) * circumference);

	const gradientId = `score-gradient-${Math.random().toString(36).slice(2, 8)}`;

	// Rich gradient colors based on score
	const gradientStops = $derived(
		score >= 70
			? { start: '#22c55e', end: '#15803d' }
			: score >= 40
				? { start: '#f59e0b', end: '#d97706' }
				: { start: '#ef4444', end: '#dc2626' }
	);
</script>

<div class="relative inline-flex items-center justify-center" style="width: {size}px; height: {size}px;">
	<svg width={size} height={size} class="-rotate-90">
		<defs>
			<linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color={gradientStops.start} />
				<stop offset="100%" stop-color={gradientStops.end} />
			</linearGradient>
			<!-- Soft glow filter -->
			<filter id="{gradientId}-glow">
				<feGaussianBlur stdDeviation="3" result="blur" />
				<feMerge>
					<feMergeNode in="blur" />
					<feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>
		</defs>
		<!-- Background ring — subtle -->
		<circle
			cx={size / 2} cy={size / 2} r={radius}
			fill="none"
			stroke="var(--color-border-subtle)"
			stroke-width={strokeWidth}
			opacity="0.6"
		/>
		<!-- Score ring — gradient with glow -->
		<circle
			cx={size / 2} cy={size / 2} r={radius}
			fill="none"
			stroke="url(#{gradientId})"
			stroke-width={strokeWidth}
			stroke-linecap="round"
			stroke-dasharray={circumference}
			stroke-dashoffset={offset}
			class="animate-draw-ring"
			style="--ring-circumference: {circumference}"
			filter="url(#{gradientId}-glow)"
		/>
	</svg>
	<div class="absolute inset-0 flex flex-col items-center justify-center">
		<span class="text-[28px] font-extrabold tracking-tighter text-[var(--color-text)]">{score}</span>
		<span class="text-[10px] font-medium tracking-wide text-[var(--color-text-tertiary)]">{label}</span>
	</div>
</div>
