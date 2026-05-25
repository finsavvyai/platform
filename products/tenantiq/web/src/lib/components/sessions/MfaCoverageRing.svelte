<script lang="ts">
	interface Props {
		percentage: number;
		total: number;
		enrolled: number;
	}

	let { percentage, total, enrolled }: Props = $props();

	const radius = 45;
	const circumference = 2 * Math.PI * radius;
	const offset = $derived(circumference - (percentage / 100) * circumference);

	const gradientId = `mfa-gradient-${Math.random().toString(36).slice(2, 8)}`;

	const gradientStops = $derived(
		percentage >= 80
			? { start: '#22c55e', end: '#15803d' }
			: percentage >= 50
			? { start: '#f59e0b', end: '#d97706' }
			: { start: '#ef4444', end: '#dc2626' },
	);
</script>

<div class="flex flex-col items-center justify-center gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
	<div class="relative inline-flex items-center justify-center" style="width: 120px; height: 120px;">
		<svg width="120" height="120" class="-rotate-90">
			<defs>
				<linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color={gradientStops.start} />
					<stop offset="100%" stop-color={gradientStops.end} />
				</linearGradient>
				<filter id="{gradientId}-glow">
					<feGaussianBlur stdDeviation="3" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>
			<circle
				cx="60" cy="60" r={radius}
				fill="none"
				stroke="var(--color-border-subtle)"
				stroke-width="8"
				opacity="0.6"
			/>
			<circle
				cx="60" cy="60" r={radius}
				fill="none"
				stroke="url(#{gradientId})"
				stroke-width="8"
				stroke-linecap="round"
				stroke-dasharray={circumference}
				stroke-dashoffset={offset}
				class="animate-draw-ring"
				filter="url(#{gradientId}-glow)"
			/>
		</svg>
		<div class="absolute inset-0 flex flex-col items-center justify-center">
			<span class="text-3xl font-extrabold text-[var(--color-text)]">{Math.round(percentage)}%</span>
			<span class="text-xs font-medium text-[var(--color-text-tertiary)]">MFA Coverage</span>
		</div>
	</div>

	<div class="w-full text-center">
		<p class="text-2xl font-bold text-[var(--color-text)]">{enrolled} of {total}</p>
		<p class="mt-1 text-sm text-[var(--color-text-secondary)]">users protected with MFA</p>
	</div>
</div>
