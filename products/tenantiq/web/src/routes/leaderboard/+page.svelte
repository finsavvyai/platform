<script lang="ts">
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import LandingFooter from '$lib/components/landing/LandingFooter.svelte';
	import { onMount } from 'svelte';
	import { Activity, Shield, Zap, AlertTriangle, GitBranch } from 'lucide-svelte';

	interface Stats {
		totalScans: number; totalControlsAudited: number; totalFindings: number;
		totalAutonomousFixes: number; totalDriftReverts: number;
		last7dScans: number; last30dActions: number; asOf: string;
	}
	interface Leaderboard {
		windowDays: number;
		byAgent: { agent: string; n: number }[];
		bySeverity: { severity: string; n: number }[];
		byAction: { action: string; n: number }[];
		generatedAt: string;
	}

	let stats = $state<Stats | null>(null);
	let lb = $state<Leaderboard | null>(null);

	onMount(async () => {
		try {
			const [s, l] = await Promise.all([
				fetch('https://api.tenantiq.app/api/stats/public').then((r) => r.json() as Promise<Stats>),
				fetch('https://api.tenantiq.app/api/stats/public/leaderboard').then((r) => r.json() as Promise<Leaderboard>),
			]);
			stats = s; lb = l;
		} catch { /* offline-tolerant */ }
	});

	const sevColor: Record<string, string> = {
		critical: 'var(--color-danger)', high: 'var(--color-warning)',
		medium: 'var(--color-warning)', low: 'var(--color-info)', info: 'var(--color-text-secondary)',
	};

	function fmt(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
		return n.toLocaleString();
	}

	function pct(n: number, total: number): number {
		return total === 0 ? 0 : Math.round((n / total) * 100);
	}

	const totalActions = $derived(lb?.byAction.reduce((s, r) => s + r.n, 0) ?? 0);
</script>

<svelte:head>
	<title>Agent Leaderboard | TenantIQ</title>
	<meta name="description" content="Live anonymized stats: what TenantIQ's autonomous Claude agents are doing across every MSP this week." />
	<link rel="canonical" href="https://app.tenantiq.app/leaderboard" />
</svelte:head>

<div class="landing">
	<LandingNav />
	<main id="main-content">
		<section class="hero">
			<div class="container">
				<span class="badge"><span class="pulse"></span> Live · last 7 days</span>
				<h1>What TenantIQ agents shipped<br /><span class="accent">this week.</span></h1>
				<p class="lede">Anonymized aggregate across every MSP running TenantIQ. Updates every 2 minutes. Built from the agent_actions log — every Claude-driven action records one row, queryable here.</p>
			</div>
		</section>

		<section class="stats">
			<div class="container">
				<div class="grid">
					<div class="cell"><Shield size={20} /><span class="big">{stats ? fmt(stats.totalControlsAudited) : '—'}</span><span class="lbl">controls audited (all-time)</span></div>
					<div class="cell"><AlertTriangle size={20} /><span class="big">{stats ? fmt(stats.totalFindings) : '—'}</span><span class="lbl">findings raised</span></div>
					<div class="cell"><Zap size={20} /><span class="big">{stats ? fmt(stats.totalAutonomousFixes) : '—'}</span><span class="lbl">fixes auto-applied</span></div>
					<div class="cell"><GitBranch size={20} /><span class="big">{stats ? fmt(stats.totalDriftReverts) : '—'}</span><span class="lbl">drift reverts</span></div>
					<div class="cell"><Activity size={20} /><span class="big">{stats ? fmt(stats.last7dScans) : '—'}</span><span class="lbl">scans this week</span></div>
					<div class="cell"><Activity size={20} /><span class="big">{stats ? fmt(stats.last30dActions) : '—'}</span><span class="lbl">total actions, 30d</span></div>
				</div>
			</div>
		</section>

		<section class="board">
			<div class="container">
				<div class="grid-2">
					<div class="card">
						<h3>Most active agents</h3>
						{#if lb && lb.byAgent.length > 0}
							<ul>
								{#each lb.byAgent as a}
									<li><span class="agent-name">{a.agent}</span><span class="bar"><span class="bar-fill" style="width: {pct(a.n, totalActions)}%;"></span></span><span class="agent-count">{fmt(a.n)}</span></li>
								{/each}
							</ul>
						{:else}<p class="empty">No agent activity in the last 7 days yet.</p>{/if}
					</div>
					<div class="card">
						<h3>Findings by severity</h3>
						{#if lb && lb.bySeverity.length > 0}
							<ul>
								{#each lb.bySeverity as s}
									<li><span class="sev-name" style="color: {sevColor[s.severity] ?? 'var(--color-text-secondary)'};">{s.severity}</span><span class="bar"><span class="bar-fill" style="width: {pct(s.n, lb.bySeverity.reduce((sum, x) => sum + x.n, 0))}%; background: {sevColor[s.severity] ?? '#94a3b8'};"></span></span><span class="agent-count">{fmt(s.n)}</span></li>
								{/each}
							</ul>
						{:else}<p class="empty">No severities recorded yet.</p>{/if}
					</div>
				</div>

				<div class="card mt">
					<h3>By action type</h3>
					{#if lb && lb.byAction.length > 0}
						<ul>
							{#each lb.byAction as a}
								<li><span class="action-name">{a.action}</span><span class="bar"><span class="bar-fill" style="width: {pct(a.n, totalActions)}%;"></span></span><span class="agent-count">{fmt(a.n)}</span></li>
							{/each}
						</ul>
					{:else}<p class="empty">No actions yet.</p>{/if}
				</div>

				<p class="footer-hint">Want to see your own MSP's autonomous-agent timeline? Sign up at <a href="/">app.tenantiq.app</a> → /skills.</p>
			</div>
		</section>
	</main>
	<LandingFooter />
</div>

<style>
	.landing { min-height: 100vh; background: var(--color-bg); padding-top: 5rem; color: #f1f5f9; }
	.container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }
	.hero { padding: 3rem 0 2rem; text-align: center; }
	.badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.875rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 999px; font-size: 0.75rem; color: #10b981; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 1rem; }
	.pulse { width: 6px; height: 6px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }
	@keyframes pulse { 70% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
	.hero h1 { font-size: 2.75rem; font-weight: 800; margin: 0 0 0.75rem 0; line-height: 1.08; letter-spacing: -0.02em; }
	.accent { background: linear-gradient(135deg, #ef4444, #f59e0b); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
	.lede { font-size: 1rem; color: #94a3b8; margin: 0 auto; max-width: 720px; line-height: 1.6; }

	.stats { padding: 2rem 0; }
	.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
	.cell { padding: 1.5rem 1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; display: flex; flex-direction: column; align-items: center; gap: 0.375rem; color: #94a3b8; }
	.cell :global(svg) { color: #ef4444; }
	.big { font-size: 2.25rem; font-weight: 800; color: #f1f5f9; line-height: 1.1; }
	.lbl { font-size: 0.8125rem; color: #64748b; }

	.board { padding: 2rem 0 4rem; }
	.grid-2 { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; }
	@media (max-width: 720px) { .grid-2 { grid-template-columns: 1fr; } }
	.card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 1.5rem; }
	.card.mt { margin-top: 1rem; }
	.card h3 { font-size: 1rem; font-weight: 600; margin: 0 0 1rem; color: #f1f5f9; }
	.card ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
	.card li { display: grid; grid-template-columns: 160px 1fr 60px; gap: 0.75rem; align-items: center; font-size: 0.875rem; color: #cbd5e1; }
	.agent-name, .sev-name, .action-name { font-family: 'SF Mono', Menlo, monospace; font-size: 0.8125rem; }
	.bar { display: block; height: 6px; background: rgba(255,255,255,0.05); border-radius: 999px; overflow: hidden; }
	.bar-fill { display: block; height: 100%; background: #ef4444; border-radius: 999px; transition: width 0.4s ease; }
	.agent-count { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
	.empty { color: #64748b; font-size: 0.875rem; margin: 0; }
	.footer-hint { margin-top: 2rem; text-align: center; font-size: 0.875rem; color: #94a3b8; }
	.footer-hint a { color: #ef4444; text-decoration: none; }
	.footer-hint a:hover { text-decoration: underline; }
</style>
