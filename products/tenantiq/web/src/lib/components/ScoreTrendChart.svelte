<script lang="ts">
	interface DataPoint {
		score: number;
		date: string;
	}

	interface Props {
		data: DataPoint[];
		height?: number;
	}

	let { data, height = 200 }: Props = $props();

	let containerEl = $state<HTMLDivElement>();
	let width = $state(600);
	let tooltip = $state<{ x: number; y: number; score: number; date: string } | null>(null);

	const padding = { top: 20, right: 20, bottom: 32, left: 40 };

	$effect(() => {
		if (!containerEl) return;
		const obs = new ResizeObserver((entries) => { width = entries[0].contentRect.width; });
		obs.observe(containerEl);
		return () => obs.disconnect();
	});

	const chartW = $derived(width - padding.left - padding.right);
	const chartH = $derived(height - padding.top - padding.bottom);

	const points = $derived(data.map((d, i) => ({
		x: padding.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
		y: padding.top + chartH - (d.score / 100) * chartH,
		score: d.score,
		date: d.date,
	})));

	const linePath = $derived(points.length < 2 ? '' : buildSmoothPath(points));
	const areaPath = $derived(points.length < 2 ? '' :
		`${linePath} L ${points[points.length - 1].x},${padding.top + chartH} L ${points[0].x},${padding.top + chartH} Z`);

	const gradientId = 'score-gradient-' + Math.random().toString(36).slice(2, 8);

	const yTicks = [0, 25, 50, 75, 100];
	const xLabels = $derived(buildXLabels(data, points));

	function buildSmoothPath(pts: { x: number; y: number }[]): string {
		if (pts.length < 2) return '';
		let d = `M ${pts[0].x},${pts[0].y}`;
		for (let i = 1; i < pts.length; i++) {
			const prev = pts[i - 1];
			const curr = pts[i];
			const cpx = (prev.x + curr.x) / 2;
			d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
		}
		return d;
	}

	function buildXLabels(d: DataPoint[], pts: { x: number }[]) {
		if (d.length <= 6) return d.map((item, i) => ({ label: formatDate(item.date), x: pts[i]?.x ?? 0 }));
		const step = Math.ceil(d.length / 5);
		return d.filter((_, i) => i % step === 0 || i === d.length - 1)
			.map((item) => {
				const idx = d.indexOf(item);
				return { label: formatDate(item.date), x: pts[idx]?.x ?? 0 };
			});
	}

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function lineColor(score: number): string {
		if (score >= 70) return 'var(--color-success)';
		if (score >= 40) return 'var(--color-warning)';
		return 'var(--color-danger)';
	}

	const avgScore = $derived(data.length ? Math.round(data.reduce((s, d) => s + d.score, 0) / data.length) : 50);
	const strokeColor = $derived(lineColor(avgScore));

	function handleMouseMove(e: MouseEvent) {
		if (!points.length || !containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		let closest = points[0];
		let minDist = Math.abs(mx - closest.x);
		for (const p of points) {
			const dist = Math.abs(mx - p.x);
			if (dist < minDist) { minDist = dist; closest = p; }
		}
		tooltip = { x: closest.x, y: closest.y, score: closest.score, date: closest.date };
	}

	function handleMouseLeave() { tooltip = null; }
</script>

<div bind:this={containerEl} class="w-full" role="img" aria-label="Score trend chart"
	onmousemove={handleMouseMove} onmouseleave={handleMouseLeave}>
	{#if data.length < 2}
		<div class="flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4"
			style="height: {height}px">
			<p class="text-sm text-[var(--color-text-secondary)]">Run more assessments to see trends</p>
		</div>
	{:else}
		<svg {width} {height} class="overflow-visible">
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={strokeColor} stop-opacity="0.2" />
					<stop offset="100%" stop-color={strokeColor} stop-opacity="0" />
				</linearGradient>
			</defs>

			<!-- Y-axis grid + labels -->
			{#each yTicks as tick}
				{@const y = padding.top + chartH - (tick / 100) * chartH}
				<line x1={padding.left} y1={y} x2={padding.left + chartW} y2={y}
					stroke="var(--color-border)" stroke-width="1" stroke-dasharray="4 4" />
				<text x={padding.left - 8} y={y + 4} text-anchor="end"
					class="text-[10px] fill-[var(--color-text-tertiary)]">{tick}</text>
			{/each}

			<!-- Area fill -->
			<path d={areaPath} fill="url(#{gradientId})" />

			<!-- Line -->
			<path d={linePath} fill="none" stroke={strokeColor} stroke-width="2.5"
				stroke-linecap="round" stroke-linejoin="round" />

			<!-- Data dots -->
			{#each points as p}
				<circle cx={p.x} cy={p.y} r="3.5" fill={lineColor(p.score)}
					stroke="var(--color-surface)" stroke-width="2" />
			{/each}

			<!-- X-axis labels -->
			{#each xLabels as lbl}
				<text x={lbl.x} y={height - 4} text-anchor="middle"
					class="text-[10px] fill-[var(--color-text-tertiary)]">{lbl.label}</text>
			{/each}

			<!-- Tooltip -->
			{#if tooltip}
				<line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={padding.top + chartH}
					stroke="var(--color-text-tertiary)" stroke-width="1" opacity="0.4" />
				<circle cx={tooltip.x} cy={tooltip.y} r="5" fill={lineColor(tooltip.score)}
					stroke="var(--color-surface)" stroke-width="2" />
				<g transform="translate({tooltip.x}, {tooltip.y - 32})">
					<rect x="-36" y="-10" width="72" height="24" rx="6"
						fill="var(--color-text)" opacity="0.9" />
					<text x="0" y="6" text-anchor="middle" class="text-[11px] font-medium"
						fill="var(--color-surface)">{tooltip.score} - {formatDate(tooltip.date)}</text>
				</g>
			{/if}
		</svg>
	{/if}
</div>
