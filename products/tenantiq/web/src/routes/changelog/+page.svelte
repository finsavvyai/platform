<script lang="ts">
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import LandingFooter from '$lib/components/landing/LandingFooter.svelte';
	import { CHANGELOG, CHANGELOG_GENERATED_AT, type EntryType } from '$lib/changelog/data';
	import { Sparkles, Bug, FileText, Shield, Server } from 'lucide-svelte';

	const typeIcon: Record<EntryType, typeof Sparkles> = {
		feat: Sparkles, fix: Bug, docs: FileText, security: Shield, infra: Server,
	};
	const typeColor: Record<EntryType, string> = {
		feat: '#10b981', fix: '#f59e0b', docs: '#94a3b8', security: '#ef4444', infra: '#60a5fa',
	};
	const typeLabel: Record<EntryType, string> = {
		feat: 'feature', fix: 'fix', docs: 'docs', security: 'security', infra: 'infra',
	};

	const counts = {
		feat: CHANGELOG.flatMap((w) => w.entries).filter((e) => e.type === 'feat').length,
		fix: CHANGELOG.flatMap((w) => w.entries).filter((e) => e.type === 'fix').length,
		docs: CHANGELOG.flatMap((w) => w.entries).filter((e) => e.type === 'docs').length,
		total: CHANGELOG.flatMap((w) => w.entries).length,
	};
</script>

<svelte:head>
	<title>Changelog — TenantIQ ships every week</title>
	<meta name="description" content="What TenantIQ shipped to production. Every entry maps to a real commit on github.com/finsavvyai/tenantiq." />
	<link rel="canonical" href="https://app.tenantiq.app/changelog" />
</svelte:head>

<div class="landing">
	<LandingNav />
	<main id="main-content">
		<section class="hero">
			<div class="container">
				<span class="badge">Production · last sync {CHANGELOG_GENERATED_AT}</span>
				<h1>What we shipped<br /><span class="accent">to main, every week.</span></h1>
				<p class="lede">No marketing fluff. Every entry below is a real commit on <a href="https://github.com/finsavvyai/tenantiq/commits/main" target="_blank" rel="noopener">github.com/finsavvyai/tenantiq</a> deployed to <code>api.tenantiq.app</code> + <code>app.tenantiq.app</code>. Snapshot is curated; raw <code>git log</code> is the canonical source.</p>
				<div class="counts">
					<div class="count"><span class="big">{counts.feat}</span><span class="lbl">features</span></div>
					<div class="count"><span class="big">{counts.fix}</span><span class="lbl">fixes</span></div>
					<div class="count"><span class="big">{counts.docs}</span><span class="lbl">docs / sales</span></div>
					<div class="count"><span class="big">{counts.total}</span><span class="lbl">total entries</span></div>
				</div>
			</div>
		</section>

		<section class="entries">
			<div class="container">
				{#each CHANGELOG as week (week.label)}
					<article class="week">
						<header class="week-head">
							<h2>{week.label}</h2>
						</header>
						<ul>
							{#each week.entries as e (e.title)}
								{@const Icon = typeIcon[e.type]}
								<li class="entry">
									<div class="entry-icon" style="background: color-mix(in srgb, {typeColor[e.type]} 12%, transparent); color: {typeColor[e.type]};">
										<Icon size={14} />
									</div>
									<div class="entry-body">
										<div class="entry-head">
											<span class="entry-type" style="color: {typeColor[e.type]};">{typeLabel[e.type]}</span>
											<h3>{e.title}</h3>
											<span class="entry-date">{e.date}</span>
										</div>
										<p>{e.body}</p>
										{#if e.commits && e.commits.length > 0}
											<p class="commits">
												{#each e.commits as sha (sha)}
													<a href="https://github.com/finsavvyai/tenantiq/commit/{sha}" target="_blank" rel="noopener" class="commit"><code>{sha}</code></a>
												{/each}
											</p>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					</article>
				{/each}
			</div>
		</section>

		<section class="footer-cta">
			<div class="container">
				<h2>Velocity is a moat</h2>
				<p>Most M365-management vendors are either (a) post-acquisition, integrating for 12–18 months (BetterCloud / CoreStack), (b) fundamentally enterprise-priced and demo-gated (CoreView, AvePoint, Syskit Point), or (c) pre-AI in product but post-AI in marketing. TenantIQ ships weekly to a single codebase. Watch this page over a quarter — that's the wedge.</p>
				<div class="cta-row">
					<a class="btn-primary" href="https://app.tenantiq.app">Start 14-day trial →</a>
					<a class="btn-secondary" href="/compare">See vs every competitor</a>
				</div>
			</div>
		</section>
	</main>
	<LandingFooter />
</div>

<style>
	.landing { min-height: 100vh; background: var(--color-bg); padding-top: 5rem; color: #f1f5f9; }
	.container { max-width: 940px; margin: 0 auto; padding: 0 1.5rem; }

	.hero { padding: 3rem 0 2rem; }
	.badge { display: inline-block; padding: 0.4rem 0.875rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 999px; font-size: 0.75rem; color: #10b981; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 1rem; }
	h1 { font-size: 2.75rem; font-weight: 800; margin: 0 0 0.75rem; letter-spacing: -0.02em; line-height: 1.08; }
	.accent { background: linear-gradient(135deg, #ef4444, #f59e0b); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
	.lede { font-size: 1rem; color: #94a3b8; max-width: 720px; margin: 0 0 1.5rem; line-height: 1.6; }
	.lede a { color: #ef4444; text-decoration: none; }
	.lede code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.85em; background: rgba(255,255,255,0.04); padding: 0.125rem 0.375rem; border-radius: 4px; }
	.counts { display: flex; gap: 1.5rem; flex-wrap: wrap; }
	.count { display: flex; flex-direction: column; gap: 0.125rem; }
	.big { font-size: 2rem; font-weight: 800; color: #ef4444; line-height: 1; }
	.lbl { font-size: 0.6875rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }

	.entries { padding: 1rem 0 3rem; }
	.week { margin-bottom: 2.5rem; }
	.week-head h2 { font-size: 1.125rem; font-weight: 700; color: #cbd5e1; margin: 0 0 1rem; padding-bottom: 0.5rem; border-bottom: 1px dashed rgba(255,255,255,0.08); }
	.week ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
	.entry { display: grid; grid-template-columns: 32px 1fr; gap: 0.875rem; padding: 1rem 1.25rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; }
	.entry-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.entry-head { display: flex; gap: 0.625rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.375rem; }
	.entry-type { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
	.entry h3 { font-size: 0.9375rem; font-weight: 600; margin: 0; color: #f1f5f9; }
	.entry-date { margin-left: auto; font-size: 0.6875rem; color: #64748b; font-family: 'SF Mono', Menlo, monospace; font-variant-numeric: tabular-nums; }
	.entry p { margin: 0.25rem 0 0; font-size: 0.875rem; color: #94a3b8; line-height: 1.55; }
	.commits { margin-top: 0.5rem !important; display: flex; gap: 0.375rem; flex-wrap: wrap; }
	.commit { font-size: 0.6875rem; }
	.commit code { font-family: 'SF Mono', Menlo, monospace; background: rgba(255,255,255,0.05); padding: 0.125rem 0.5rem; border-radius: 4px; color: #ef4444; text-decoration: none; }
	.commit:hover code { background: rgba(239,68,68,0.1); }

	.footer-cta { padding: 3rem 0; text-align: center; border-top: 1px dashed rgba(255,255,255,0.08); }
	.footer-cta h2 { font-size: 1.75rem; font-weight: 700; margin: 0 0 0.75rem; }
	.footer-cta p { font-size: 0.9375rem; color: #94a3b8; max-width: 700px; margin: 0 auto 1.5rem; line-height: 1.6; }
	.cta-row { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
	.btn-primary, .btn-secondary { padding: 0.75rem 1.25rem; border-radius: 10px; font-weight: 600; font-size: 0.95rem; text-decoration: none; }
	.btn-primary { background: #ef4444; color: white; }
	.btn-secondary { border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; }
</style>
