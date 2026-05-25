<script lang="ts">
	import { TrendingUp, TrendingDown, Minus } from 'lucide-svelte';

	interface Point { date: string; score: number; assessmentsThatDay: number }
	interface Summary {
		windowDays: number;
		assessmentCount: number;
		latestScore: number | null;
		earliestScore: number | null;
		scoreDelta: number;
		direction: 'improving' | 'regressing' | 'stable';
	}
	interface Props { framework: string; points: Point[]; summary: Summary }

	let { framework, points, summary }: Props = $props();

	const W = 600;
	const H = 160;
	const PAD = 24;

	const path = $derived.by(() => {
		if (points.length === 0) return '';
		if (points.length === 1) {
			const x = W / 2;
			const y = H - PAD - ((points[0].score / 100) * (H - 2 * PAD));
			return `M${x},${y}`;
		}
		const step = (W - 2 * PAD) / Math.max(1, points.length - 1);
		return points.map((p, i) => {
			const x = PAD + i * step;
			const y = H - PAD - ((p.score / 100) * (H - 2 * PAD));
			return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
		}).join(' ');
	});

	const areaPath = $derived.by(() => {
		if (!path) return '';
		const step = (W - 2 * PAD) / Math.max(1, points.length - 1);
		const lastX = PAD + (points.length - 1) * step;
		return `${path} L${lastX.toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;
	});

	const DirectionIcon = $derived(
		summary.direction === 'improving' ? TrendingUp
			: summary.direction === 'regressing' ? TrendingDown
			: Minus,
	);
	const directionColor = $derived(
		summary.direction === 'improving' ? 'var(--color-success)'
			: summary.direction === 'regressing' ? 'var(--color-danger)'
			: 'var(--color-text-secondary)',
	);
	const directionLabel = $derived(
		summary.direction === 'improving' ? `Improving (+${summary.scoreDelta})`
			: summary.direction === 'regressing' ? `Regressing (${summary.scoreDelta})`
			: `Stable (${summary.scoreDelta >= 0 ? '+' : ''}${summary.scoreDelta})`,
	);

	function fmtDate(s: string): string {
		const d = new Date(s);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<div class="trend-card">
	<header class="trend-head">
		<div>
			<h3>{framework} Score Trend</h3>
			<p class="trend-sub">Last {summary.windowDays} days · {summary.assessmentCount} assessment{summary.assessmentCount === 1 ? '' : 's'}</p>
		</div>
		<div class="trend-direction" style="color: {directionColor}; background: color-mix(in srgb, {directionColor} 12%, transparent);">
			<DirectionIcon size={14} />
			<span>{directionLabel}</span>
		</div>
	</header>

	{#if points.length === 0}
		<div class="empty">
			<p>No assessment history yet. Re-run /frameworks to start the trend.</p>
		</div>
	{:else}
		<div class="chart-wrap">
			<svg viewBox="0 0 {W} {H}" class="chart" role="img" aria-label="{framework} score trend">
				{#each [25, 50, 75] as g}
					{@const y = H - PAD - (g / 100) * (H - 2 * PAD)}
					<line x1={PAD} x2={W - PAD} y1={y} y2={y} class="grid-line" />
					<text x={PAD - 4} y={y + 3} class="grid-label">{g}</text>
				{/each}
				<path d={areaPath} class="area" />
				<path d={path} class="line" />
				{#each points as p, i}
					{@const step = (W - 2 * PAD) / Math.max(1, points.length - 1)}
					{@const x = PAD + i * step}
					{@const y = H - PAD - ((p.score / 100) * (H - 2 * PAD))}
					<circle cx={x} cy={y} r="3.5" class="point">
						<title>{fmtDate(p.date)}: {p.score}/100 ({p.assessmentsThatDay} assessment{p.assessmentsThatDay === 1 ? '' : 's'})</title>
					</circle>
				{/each}
			</svg>
		</div>

		<div class="trend-footer">
			<div class="metric"><span class="metric-label">Earliest</span><span class="metric-value">{summary.earliestScore ?? '—'}</span></div>
			<div class="metric"><span class="metric-label">Latest</span><span class="metric-value">{summary.latestScore ?? '—'}</span></div>
			<div class="metric"><span class="metric-label">Δ</span><span class="metric-value" style="color: {directionColor};">{summary.scoreDelta >= 0 ? '+' : ''}{summary.scoreDelta}</span></div>
		</div>
	{/if}
</div>

<style>
	.trend-card { padding: 1.25rem; border: 1px solid var(--color-border); border-radius: 0.75rem; background: var(--color-surface); }
	.trend-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; }
	.trend-head h3 { font-size: 0.9375rem; font-weight: 600; margin: 0; }
	.trend-sub { font-size: 0.75rem; color: var(--color-text-secondary); margin: 0.125rem 0 0 0; }
	.trend-direction { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.625rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 500; }
	.empty { padding: 2rem 0; text-align: center; color: var(--color-text-secondary); font-size: 0.875rem; }
	.chart-wrap { width: 100%; }
	.chart { width: 100%; height: auto; max-height: 200px; display: block; }
	.grid-line { stroke: var(--color-border); stroke-width: 1; stroke-dasharray: 2 3; }
	.grid-label { font-size: 9px; fill: var(--color-text-tertiary); text-anchor: end; }
	.area { fill: color-mix(in srgb, var(--color-primary) 12%, transparent); }
	.line { stroke: var(--color-primary); stroke-width: 2; fill: none; }
	.point { fill: var(--color-primary); stroke: var(--color-surface); stroke-width: 2; cursor: pointer; }
	.point:hover { r: 5; }
	.trend-footer { display: flex; gap: 1.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
	.metric { display: flex; flex-direction: column; gap: 0.125rem; }
	.metric-label { font-size: 0.6875rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
	.metric-value { font-size: 1.125rem; font-weight: 600; color: var(--color-text); }
</style>
