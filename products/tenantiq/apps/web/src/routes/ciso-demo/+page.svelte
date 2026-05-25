<script lang="ts">
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import LandingFooter from '$lib/components/landing/LandingFooter.svelte';
	import { ArrowRight, ScanLine, Activity, Clock, Shield, Layers, Plug, Sparkles } from 'lucide-svelte';

	const STEPS = [
		{
			n: 1, time: '~90s',
			icon: ScanLine,
			title: 'The autonomous lead-in scan',
			talk: '"Three weeks ago Anthropic shipped Claude as a single agent across M365. That commoditises AI inside one customer\'s tenant. What it doesn\'t address is the layer above — managing other people\'s tenants at scale. That\'s what TenantIQ does."',
			demo: [
				{ label: 'Open', href: '/scan/microsoft.com', text: '/scan/microsoft.com' },
				{ label: 'Refresh mid-talk', text: 'so the SSE narration paints stage by stage in the room.' },
			],
			expect: 'CISO question: "Does this hit our tenant?" → A: "Public DNS + Microsoft\'s openid-configuration only. Read-only, no credentials."',
		},
		{
			n: 2, time: '~3m',
			icon: Activity,
			title: 'Live agent feed — autonomous + safe',
			talk: '"Every autonomous action across this org\'s tenants in the last 24h. Append-only `agent_actions` table, JWT-scoped to the org. Sub-second push via a Cloudflare Durable Object."',
			demo: [
				{ label: 'Open', href: '/agents', text: '/agents (admin only)' },
				{ label: 'Walk through', text: '3 row types: autonomous-auditor email, auto-remediator pending-approval (dry-run), auto-remediator rollback (anomaly-detected).' },
				{ label: 'Click', text: 'Approve on a pending row → toast → live re-enqueue → new row in <5s.' },
			],
			expect: '"How do I stop a runaway agent?" → A: per-tenant mode flag, daily cap of 5, source-pinned recipes (PR not runtime).',
		},
		{
			n: 3, time: '~2m',
			icon: Clock,
			title: 'Time-traveling agent — incident response',
			talk: '"What did our CA policies look like at 3am Tuesday? Most tools say \'check your snapshots.\' We rebuild the state."',
			demo: [
				{ label: 'Open', href: '/security/timewarp', text: '/security/timewarp' },
				{ label: 'Click', text: '24h ago preset → Travel → narrate the JSON tree + audit summary.' },
			],
			expect: '"What if snapshots have gaps?" → A: we say so explicitly — "No snapshot before this timestamp." We don\'t fabricate state.',
		},
		{
			n: 4, time: '~2m',
			icon: Shield,
			title: 'CIS depth + per-tenant overrides',
			talk: '"121 controls, 31+ wired to live Graph. The override engine is the differentiator — risk-acceptance is auditor-grade, per tenant, ScubaGear-style."',
			demo: [
				{ label: 'Open', href: '/security/cis', text: '/security/cis' },
				{ label: 'Expand', text: 'a finding → show the AI explainer card (Claude with tenant context, 4–6 sentence remediation).' },
			],
			expect: '"Does Claude decide to mutate state?" → A: never. Claude explains; deterministic code acts.',
		},
		{
			n: 5, time: '~30s',
			icon: Layers,
			title: 'Cross-tenant rollups — the MSP scope',
			talk: '"Anonymized aggregate across every MSP running TenantIQ. Same `agent_actions` table, just rolled up. Transparency + distribution."',
			demo: [
				{ label: 'Open', href: '/leaderboard', text: '/leaderboard (no auth)' },
			],
			expect: 'Subtle: this URL is screenshot-shareable. CISOs forward it to peer CISOs.',
		},
		{
			n: 6, time: '~90s',
			icon: Plug,
			title: 'External MCP — the composer',
			talk: '"This is the strategic move. We ship our own MCP server, but we\'re also an MCP client. Microsoft Graph MCP, GitHub MCP, Moody\'s MCP — TenantIQ\'s AI Agent calls them alongside ours. We don\'t compete with the MCP ecosystem; we orchestrate it."',
			demo: [
				{ label: 'Open', href: '/settings/mcp-clients', text: '/settings/mcp-clients' },
				{ label: 'Show', text: 'the form + the would-be tools list. Don\'t actually save anything.' },
			],
			expect: '"Where does the auth go?" → A: per-server Bearer, encrypted at rest, never returned in API responses (`hasBearer: bool` only).',
		},
		{
			n: 7, time: '~2m',
			icon: Sparkles,
			title: 'Outside the dashboard — Claude Desktop',
			talk: '"Same data, the conversation surface your team already lives in. Two surfaces, one source of truth, role gating enforced server-side. No jailbreak in Claude config can grant write access."',
			demo: [
				{ label: 'Switch to', text: 'Claude Desktop with MCP server `tenantiq` configured + demo bearer `tiq_demo_visitor_2026`.' },
				{ label: 'Type', text: '"Show me the CIS posture for the Acme tenant" → Claude calls get_cis_posture, narrates the score.' },
				{ label: 'Optional', text: '"Run the onboarding template on Globex" → Claude pulls onboard_tenant prompt + calls apply_skill_template.' },
			],
			expect: 'This is the close — they will ask "How do I get this for my org?" That is the cue for step 8.',
		},
		{
			n: 8, time: '~1m',
			icon: ArrowRight,
			title: 'The ask',
			talk: '"What I want: a 14-day pilot on three of your tenants, dry-run mode only. Zero Graph mutations. We populate /agents and /security/timewarp with real data. You decide if the autonomous narrative is what your team needs. If yes, you flip the per-tenant mode flag — per tenant, your call, reversible any time."',
			demo: [
				{ label: 'Open', href: '/compare', text: '/compare' },
				{ label: 'Show', text: 'the first table only — vs horizontal AI assistants. Every row a wedge.' },
			],
			expect: 'Two questions to land: which 3 tenants, and which admin to invite first.',
		},
	];
</script>

<svelte:head>
	<title>CISO Demo — How TenantIQ Works | TenantIQ</title>
	<meta name="description" content="15-minute demo flow walking a security leader through TenantIQ — autonomous agents, time-traveling reconstruction, source-pinned safety controls, MCP composer." />
	<link rel="canonical" href="https://app.tenantiq.app/ciso-demo" />
</svelte:head>

<div class="landing">
	<LandingNav />
	<main id="main-content">
		<section class="hero">
			<div class="container">
				<span class="badge">For security leaders · 15 min</span>
				<h1>The CISO Demo</h1>
				<p class="lede">Eight steps. No slides. Real product, real data (or synthetic via a public demo key). Built so a security leader can hand this URL to a peer and walk through it solo.</p>
				<div class="cta-row">
					<a class="btn-primary" href="/scan/microsoft.com">Start at step 1 →</a>
					<a class="btn-secondary" href="/compare">Skip to comparison</a>
				</div>
				<p class="hint">Want it as a PDF for offline reading? <a href="https://github.com/finsavvyai/tenantiq/blob/main/docs/sales/CISO_DEMO_SCRIPT.md" target="_blank" rel="noopener">Demo script (GitHub)</a> · <a href="https://github.com/finsavvyai/tenantiq/blob/main/docs/sales/HOW_IT_WORKS.md" target="_blank" rel="noopener">Architecture one-pager</a></p>
			</div>
		</section>

		<section class="steps">
			<div class="container">
				{#each STEPS as step}
					<article class="step">
						<header>
							<div class="num"><svelte:component this={step.icon} size={20} /></div>
							<div class="head-text">
								<span class="t">{step.time}</span>
								<h2>{step.n}. {step.title}</h2>
							</div>
						</header>
						<blockquote class="talk">{step.talk}</blockquote>
						<ul class="demo">
							{#each step.demo as d}
								<li>
									{#if d.href}
										<a href={d.href} class="action">{d.label} <ArrowRight size={12} /> <code>{d.text}</code></a>
									{:else}
										<span class="action-dim"><strong>{d.label}.</strong> {d.text}</span>
									{/if}
								</li>
							{/each}
						</ul>
						<p class="expect"><strong>Expect:</strong> {step.expect}</p>
					</article>
				{/each}
			</div>
		</section>

		<section class="close">
			<div class="container">
				<h2>Anticipated questions</h2>
				<dl>
					<dt>"What if your AI hallucinates a recipe?"</dt>
					<dd>Recipes are source-pinned. Code, not data. Adding one is a PR. AI explains; deterministic code acts.</dd>
					<dt>"How do I stop a runaway agent right now?"</dt>
					<dd>Three layers. (1) Per-tenant <code>autofix:mode</code> KV flag — flip to dry-run instantly via API. (2) Daily cap of 5 enqueues per tenant per 24h, KV-enforced, can't be bypassed. (3) Source-pinned recipes — adding new ones requires a code commit.</dd>
					<dt>"How do I get out?"</dt>
					<dd>Account-deletion cascade — 33 tables, contract test in CI. GDPR Art. 17 + M365 Cert C7. Single API call.</dd>
					<dt>"Pen test? SOC 2 Type II?"</dt>
					<dd>Pen test targeting Q3 2026. SOC 2 Type II in flight, H2 2026 — honest about not done yet.</dd>
				</dl>
			</div>
		</section>
	</main>
	<LandingFooter />
</div>

<style>
	.landing { min-height: 100vh; background: var(--color-bg); padding-top: 5rem; color: #f1f5f9; }
	.container { max-width: 880px; margin: 0 auto; padding: 0 1.5rem; }
	.hero { padding: 3rem 0 2rem; text-align: center; }
	.badge { display: inline-block; padding: 0.4rem 0.875rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 999px; font-size: 0.75rem; color: #10b981; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 1rem; }
	.hero h1 { font-size: 2.75rem; font-weight: 800; margin: 0 0 0.75rem; letter-spacing: -0.02em; }
	.lede { font-size: 1.0625rem; color: #94a3b8; max-width: 680px; margin: 0 auto 1.5rem; line-height: 1.55; }
	.cta-row { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
	.btn-primary, .btn-secondary { padding: 0.75rem 1.25rem; border-radius: 10px; font-weight: 600; font-size: 0.95rem; text-decoration: none; }
	.btn-primary { background: #ef4444; color: white; }
	.btn-secondary { border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; }
	.hint { margin-top: 1.25rem; font-size: 0.8125rem; color: #64748b; }
	.hint a { color: #94a3b8; }

	.steps { padding: 1rem 0 3rem; }
	.step { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 1.5rem; margin-bottom: 1rem; }
	.step header { display: flex; gap: 0.875rem; align-items: flex-start; margin-bottom: 1rem; }
	.num { width: 36px; height: 36px; border-radius: 50%; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.head-text { flex: 1; }
	.t { font-size: 0.6875rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
	.step h2 { margin: 0; font-size: 1.0625rem; font-weight: 600; color: #f1f5f9; }
	.talk { margin: 0 0 1rem; padding: 0.875rem 1rem; border-left: 3px solid #ef4444; background: rgba(239,68,68,0.04); color: #cbd5e1; font-size: 0.875rem; font-style: italic; line-height: 1.55; }
	.demo { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
	.action, .action-dim { font-size: 0.8125rem; line-height: 1.55; }
	.action { color: #ef4444; text-decoration: none; display: inline-flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }
	.action:hover { color: #f87171; }
	.action code { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; color: #e2e8f0; font-family: 'SF Mono', Menlo, monospace; }
	.action-dim { color: #94a3b8; }
	.action-dim strong { color: #cbd5e1; }
	.expect { margin: 0; font-size: 0.75rem; color: #64748b; padding: 0.5rem 0.75rem; border-top: 1px dashed rgba(255,255,255,0.08); }
	.expect strong { color: #94a3b8; }

	.close { padding: 2rem 0 4rem; }
	.close h2 { font-size: 1.5rem; font-weight: 700; margin: 0 0 1.25rem; }
	.close dl { display: flex; flex-direction: column; gap: 1rem; }
	.close dt { font-size: 0.9375rem; font-weight: 600; color: #f1f5f9; }
	.close dd { margin: 0.25rem 0 0; font-size: 0.875rem; color: #94a3b8; line-height: 1.55; }
	.close code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.8125rem; background: rgba(255,255,255,0.04); padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
</style>
