<script lang="ts">
	import { ShieldCheck, GitCommit, Database, ScrollText, FlaskConical, Users } from 'lucide-svelte';

	// Verifiable in the repo at github.com/finsavvyai/tenantiq.
	// Refresh script: .luna/tenantiq/refresh-trust-signals.sh (manual)
	const SIGNALS = [
		{ icon: FlaskConical, value: '1,571', label: 'unit + integration tests passing', source: 'cd apps/api && npx vitest run' },
		{ icon: GitCommit, value: '224', label: 'API route TS files', source: 'find apps/api/src/routes -name "*.ts"' },
		{ icon: Database, value: '34', label: 'D1 tables · 26 migrations', source: 'packages/db/schema-d1.ts' },
		{ icon: ScrollText, value: '21', label: 'cron jobs · 8 queue handlers', source: 'apps/api/src/cron/' },
		{ icon: ShieldCheck, value: '33', label: 'tables in account-deletion cascade · CI contract test', source: 'apps/api/src/lib/account-deletion.ts' },
		{ icon: Users, value: '102', label: 'web pages · 196 Svelte components', source: 'apps/web/src/routes' },
	];

	// Real customer quotes go here when they exist. Until then, this section
	// is intentionally empty rather than fabricated.
	const TESTIMONIALS: Array<{ quote: string; author: string; role: string; tenants: number }> = [];
</script>

<section class="trust-section" id="trust">
	<div class="container">
		<header class="head">
			<span class="badge">Production · verifiable in the repo</span>
			<h2>What we don't say without being able to prove it.</h2>
			<p>Every number below is grep-able in our public repo at <a href="https://github.com/finsavvyai/tenantiq" target="_blank" rel="noopener">github.com/finsavvyai/tenantiq</a>. No customer logos we don't have, no metrics we'd be embarrassed to source-cite under a CISO's questions.</p>
		</header>

		<div class="signals">
			{#each SIGNALS as s (s.label)}
				<div class="signal">
					<svelte:component this={s.icon} size={20} />
					<div class="text">
						<span class="big">{s.value}</span>
						<span class="lbl">{s.label}</span>
						<code class="src">{s.source}</code>
					</div>
				</div>
			{/each}
		</div>

		<div class="links">
			<a href="/changelog" class="link">Changelog →</a>
			<a href="/leaderboard" class="link">Live aggregate counters →</a>
			<a href="/compare" class="link">Comparison vs every competitor →</a>
			<a href="/ciso-demo" class="link">CISO demo (15 min) →</a>
		</div>

		{#if TESTIMONIALS.length > 0}
			<div class="quotes">
				{#each TESTIMONIALS as t}
					<blockquote>
						<p>"{t.quote}"</p>
						<footer>{t.author} · <span>{t.role}, managing {t.tenants} tenants</span></footer>
					</blockquote>
				{/each}
			</div>
		{:else}
			<p class="quotes-empty">
				<strong>Customer quotes go here when we have real ones.</strong> Pre-launch — pilot customers haven't signed off on attribution yet. Rather than fabricate testimonials, we leave this section empty until they exist. The first three pilot MSPs who let us cite them get a permanent /compare row that names them by choice.
			</p>
		{/if}
	</div>
</section>

<style>
	.trust-section { padding: 4rem 5%; background: rgba(255,255,255,0.01); border-top: 1px dashed rgba(255,255,255,0.06); border-bottom: 1px dashed rgba(255,255,255,0.06); }
	.container { max-width: 1100px; margin: 0 auto; }
	.head { text-align: center; margin-bottom: 2.5rem; max-width: 720px; margin-inline: auto; }
	.badge { display: inline-block; padding: 0.4rem 0.875rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 999px; font-size: 0.75rem; color: #10b981; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 1rem; }
	.head h2 { font-size: 2rem; font-weight: 700; margin: 0 0 0.75rem; letter-spacing: -0.02em; }
	.head p { font-size: 1rem; color: #94a3b8; line-height: 1.6; margin: 0; }
	.head a { color: #ef4444; text-decoration: none; }

	.signals { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.875rem; margin-bottom: 2rem; }
	.signal { display: grid; grid-template-columns: 22px 1fr; gap: 0.75rem; padding: 1.125rem 1.25rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; align-items: start; }
	.signal :global(svg) { color: #ef4444; margin-top: 2px; }
	.text { display: flex; flex-direction: column; gap: 0.125rem; }
	.big { font-size: 1.625rem; font-weight: 800; color: #f1f5f9; line-height: 1.05; }
	.lbl { font-size: 0.8125rem; color: #cbd5e1; line-height: 1.4; }
	.src { font-family: 'SF Mono', Menlo, monospace; font-size: 0.6875rem; color: #64748b; margin-top: 0.25rem; word-break: break-all; }

	.links { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-bottom: 2rem; }
	.link { font-size: 0.875rem; color: #ef4444; text-decoration: none; }
	.link:hover { text-decoration: underline; }

	.quotes-empty { text-align: center; color: #94a3b8; font-size: 0.875rem; line-height: 1.6; max-width: 720px; margin: 0 auto; padding: 1.25rem 1.5rem; background: rgba(245,158,11,0.04); border-left: 3px solid #f59e0b; border-radius: 0 10px 10px 0; }
	.quotes-empty strong { color: #cbd5e1; }
	.quotes { display: grid; gap: 1rem; }
	blockquote { margin: 0; padding: 1.25rem 1.5rem; background: rgba(255,255,255,0.02); border-left: 3px solid #ef4444; border-radius: 0 10px 10px 0; }
	blockquote p { font-size: 1rem; color: #e2e8f0; line-height: 1.6; font-style: italic; margin: 0 0 0.5rem; }
	blockquote footer { font-size: 0.8125rem; color: #94a3b8; }
	blockquote span { color: #64748b; }
</style>
