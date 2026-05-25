<script lang="ts">
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import LandingFooter from '$lib/components/landing/LandingFooter.svelte';
	import CompareTable from '$lib/compare/CompareTable.svelte';
	import { vendorBySlug } from '$lib/compare/vendors';
	import { rowsBySlug } from '$lib/compare/rows';
	import { page } from '$app/state';
	import { ArrowLeft, FileText, Printer } from 'lucide-svelte';

	const slug = $derived(page.params.vendor ?? '');
	const vendor = $derived(vendorBySlug(slug));
	const rows = $derived(rowsBySlug[slug] ?? []);

	const tenantiqUnique = $derived(rows.filter((r) => r.tenantiq.status === 'unique').length);
	const themWins = $derived(rows.filter((r) => r.them.status === 'yes' && r.tenantiq.status !== 'yes' && r.tenantiq.status !== 'unique').length);
</script>

<svelte:head>
	{#if vendor}
		<title>TenantIQ vs {vendor.name} | Comparison</title>
		<meta name="description" content="TenantIQ vs {vendor.name}. {vendor.tagline}. Honest side-by-side comparison with sources cited." />
		<link rel="canonical" href="https://app.tenantiq.app/compare/{vendor.slug}" />
	{:else}
		<title>Comparison not found | TenantIQ</title>
	{/if}
</svelte:head>

<div class="landing">
	<LandingNav />
	<main id="main-content">
		{#if !vendor}
			<section class="container hero">
				<h1>That comparison doesn't exist</h1>
				<p class="lede">Check <a href="/compare">/compare</a> for the full list.</p>
			</section>
		{:else}
			<section class="hero">
				<div class="container">
					<a href="/compare" class="back"><ArrowLeft size={14} /> All comparisons</a>
					<h1>TenantIQ vs <span class="accent">{vendor.name}</span></h1>
					<p class="tagline">{vendor.tagline}</p>
					<div class="meta-row">
						<span class="badge unique">{tenantiqUnique} TenantIQ-unique</span>
						<span class="badge them">{themWins} where {vendor.name.split(' ')[0]} wins</span>
						<span class="badge total">{rows.length} capabilities compared</span>
					</div>
					<p class="subhead">{vendor.subhead}</p>
				</div>
			</section>

			<section class="container actions-row">
				<a class="action" href="/compare/{vendor.slug}/print" target="_blank" rel="noopener">
					<Printer size={14} /> Printable 1-pager
				</a>
				{#if vendor.dossierUrl}
					<a class="action" href={vendor.dossierUrl} target="_blank" rel="noopener">
						<FileText size={14} /> Full dossier (cited sources)
					</a>
				{/if}
			</section>

			<section class="container table-section">
				<CompareTable themLabel={vendor.name} {rows} />
			</section>

			{#if vendor.dontFightOn.length > 0}
				<section class="container honest">
					<h2>Where {vendor.name.split(' ')[0]} legitimately wins</h2>
					<p class="honest-lede">Honest disclosure. We don't fight on these — they're real moats backed by years of investment, scale, or integration depth.</p>
					<ul>
						{#each vendor.dontFightOn as item}
							<li>{item}</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="container cta">
				<h2>14-day pilot, three of your tenants, dry-run mode only</h2>
				<p>Zero Graph mutations. We populate <code>/agents</code> and <code>/security/timewarp</code> with real data. You decide if the autonomous narrative is what your team needs. If yes, you flip the per-tenant mode flag — per tenant, your call, reversible any time.</p>
				<div class="cta-row">
					<a class="btn-primary" href="https://app.tenantiq.app">Start 14-day trial →</a>
					<a class="btn-secondary" href="/ciso-demo">CISO demo (15 min)</a>
				</div>
			</section>
		{/if}
	</main>
	<LandingFooter />
</div>

<style>
	.landing { min-height: 100vh; background: var(--color-bg); padding-top: 5rem; color: #f1f5f9; }
	.container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }
	.hero { padding: 2.5rem 0 1.5rem; }
	.back { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: #94a3b8; text-decoration: none; margin-bottom: 1rem; }
	.back:hover { color: #e2e8f0; }
	h1 { font-size: 2.5rem; font-weight: 800; margin: 0 0 0.5rem; letter-spacing: -0.02em; line-height: 1.1; }
	.accent { background: linear-gradient(135deg, #ef4444, #f59e0b); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
	.tagline { font-size: 1.0625rem; color: #cbd5e1; margin: 0 0 1rem; }
	.meta-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
	.badge { font-size: 0.6875rem; padding: 0.25rem 0.625rem; border-radius: 999px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
	.badge.unique { background: rgba(239,68,68,0.12); color: #ef4444; }
	.badge.them { background: rgba(245,158,11,0.1); color: #f59e0b; }
	.badge.total { background: rgba(255,255,255,0.05); color: #94a3b8; }
	.subhead { font-size: 0.9375rem; color: #94a3b8; line-height: 1.6; max-width: 820px; margin: 0; }
	.actions-row { display: flex; gap: 0.5rem; padding: 0.5rem 1.5rem; flex-wrap: wrap; }
	.action { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 0.875rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; font-size: 0.8125rem; color: #e2e8f0; text-decoration: none; }
	.action:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); }
	.table-section { padding: 1.5rem 0; }
	.honest { margin-top: 2rem; padding: 1.5rem 1.5rem; background: rgba(255,255,255,0.02); border-left: 3px solid #f59e0b; border-radius: 0 14px 14px 0; }
	.honest h2 { font-size: 1.125rem; font-weight: 700; margin: 0 0 0.5rem; }
	.honest-lede { font-size: 0.875rem; color: #94a3b8; margin: 0 0 0.75rem; }
	.honest ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.375rem; }
	.honest li { font-size: 0.875rem; color: #cbd5e1; padding-left: 1.5rem; position: relative; }
	.honest li::before { content: '→'; position: absolute; left: 0; color: #f59e0b; }
	.cta { padding: 3rem 0; text-align: center; }
	.cta h2 { font-size: 1.75rem; font-weight: 700; margin: 0 0 0.75rem; }
	.cta p { font-size: 0.9375rem; color: #94a3b8; max-width: 720px; margin: 0 auto 1.5rem; line-height: 1.6; }
	.cta code { font-family: 'SF Mono', Menlo, monospace; background: rgba(255,255,255,0.04); padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.8125rem; }
	.cta-row { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
	.btn-primary, .btn-secondary { padding: 0.75rem 1.25rem; border-radius: 10px; font-weight: 600; font-size: 0.95rem; text-decoration: none; }
	.btn-primary { background: #ef4444; color: white; }
	.btn-secondary { border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; }
</style>
