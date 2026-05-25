<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Activity, Shield, Zap, AlertTriangle, GitBranch } from 'lucide-svelte';

	interface Stats {
		totalScans: number;
		totalControlsAudited: number;
		totalFindings: number;
		totalAutonomousFixes: number;
		totalDriftReverts: number;
		last7dScans: number;
		last30dActions: number;
		asOf: string;
	}

	let stats = $state<Stats | null>(null);
	let displayed = $state<Stats | null>(null);
	let interval: ReturnType<typeof setInterval> | null = null;
	let tick: ReturnType<typeof setInterval> | null = null;

	const API_BASE = 'https://api.tenantiq.app/api';

	async function load() {
		try {
			const res = await fetch(`${API_BASE}/stats/public`);
			if (res.ok) stats = await res.json() as Stats;
		} catch { /* offline-tolerant */ }
	}

	onMount(() => {
		load();
		// poll every 30s for live-ish feel
		interval = setInterval(load, 30_000);
		// animate displayed counts toward `stats` for the ticker effect
		tick = setInterval(() => {
			if (!stats) return;
			if (!displayed) { displayed = stats; return; }
			displayed = {
				...displayed,
				totalScans: lerp(displayed.totalScans, stats.totalScans),
				totalControlsAudited: lerp(displayed.totalControlsAudited, stats.totalControlsAudited),
				totalFindings: lerp(displayed.totalFindings, stats.totalFindings),
				totalAutonomousFixes: lerp(displayed.totalAutonomousFixes, stats.totalAutonomousFixes),
				totalDriftReverts: lerp(displayed.totalDriftReverts, stats.totalDriftReverts),
				last7dScans: stats.last7dScans,
				last30dActions: stats.last30dActions,
				asOf: stats.asOf,
			};
		}, 80);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
		if (tick) clearInterval(tick);
	});

	function lerp(from: number, to: number): number {
		if (from === to) return to;
		const delta = (to - from) * 0.18;
		const next = from + delta;
		return Math.abs(to - next) < 0.5 ? to : next;
	}

	function fmt(n: number): string {
		if (!n) return '0';
		const r = Math.round(n);
		if (r >= 1_000_000) return `${(r / 1_000_000).toFixed(1)}M`;
		if (r >= 1_000) return `${(r / 1_000).toFixed(1)}k`;
		return r.toLocaleString();
	}
</script>

<section class="counter-section">
	<header>
		<span class="badge">
			<Activity size={12} />
			<span class="pulse"></span>
			Live · autonomous activity
		</span>
		<h2>What TenantIQ agents are doing right now</h2>
		<p>Anonymized aggregate across every MSP running TenantIQ. Updates every 30 seconds.</p>
	</header>
	<div class="grid">
		<div class="cell">
			<Shield size={18} />
			<span class="big">{displayed ? fmt(displayed.totalControlsAudited) : '—'}</span>
			<span class="lbl">controls audited</span>
		</div>
		<div class="cell">
			<AlertTriangle size={18} />
			<span class="big">{displayed ? fmt(displayed.totalFindings) : '—'}</span>
			<span class="lbl">findings raised</span>
		</div>
		<div class="cell">
			<Zap size={18} />
			<span class="big">{displayed ? fmt(displayed.totalAutonomousFixes) : '—'}</span>
			<span class="lbl">fixes auto-applied</span>
		</div>
		<div class="cell">
			<GitBranch size={18} />
			<span class="big">{displayed ? fmt(displayed.totalDriftReverts) : '—'}</span>
			<span class="lbl">drift reverts</span>
		</div>
		<div class="cell">
			<Activity size={18} />
			<span class="big">{displayed ? fmt(displayed.last7dScans) : '—'}</span>
			<span class="lbl">scans this week</span>
		</div>
	</div>
	<p class="footer-hint"><a href="/leaderboard">See the full leaderboard →</a></p>
</section>

<style>
	.counter-section { padding: 4rem 5%; max-width: 1100px; margin: 0 auto; text-align: center; }
	header { margin-bottom: 2.5rem; }
	.badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.875rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 999px; font-size: 0.75rem; color: #10b981; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 1rem; position: relative; }
	.pulse { width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 0 rgba(16,185,129,0.7); animation: pulse 2s infinite; }
	@keyframes pulse { 70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
	header h2 { font-size: 2.25rem; font-weight: 700; margin: 0 0 0.5rem 0; letter-spacing: -0.02em; }
	header p { font-size: 1rem; color: #94a3b8; margin: 0; }
	.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
	.cell { padding: 1.5rem 1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; display: flex; flex-direction: column; align-items: center; gap: 0.375rem; color: #94a3b8; }
	.cell :global(svg) { color: #ef4444; }
	.big { font-size: 2.5rem; font-weight: 800; color: #f1f5f9; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; line-height: 1.1; }
	.lbl { font-size: 0.8125rem; color: #64748b; }
	.footer-hint { margin-top: 2rem; font-size: 0.875rem; color: #94a3b8; }
	.footer-hint a { color: #ef4444; text-decoration: none; font-weight: 500; }
	.footer-hint a:hover { text-decoration: underline; }
	@media (max-width: 600px) { .big { font-size: 1.875rem; } }
</style>
