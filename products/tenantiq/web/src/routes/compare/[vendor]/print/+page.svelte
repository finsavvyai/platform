<script lang="ts">
	import { vendorBySlug } from '$lib/compare/vendors';
	import { rowsBySlug } from '$lib/compare/rows';
	import { page } from '$app/state';
	import { Check, X, Minus, Zap } from 'lucide-svelte';

	const slug = $derived(page.params.vendor ?? '');
	const vendor = $derived(vendorBySlug(slug));
	const rows = $derived(rowsBySlug[slug] ?? []);

	const today = $derived(new Date().toISOString().slice(0, 10));
	const tenantiqUnique = $derived(rows.filter((r) => r.tenantiq.status === 'unique').length);
	const themWins = $derived(rows.filter((r) => r.them.status === 'yes' && r.tenantiq.status !== 'yes' && r.tenantiq.status !== 'unique').length);

	const statusIcon = { yes: Check, no: X, partial: Minus, unique: Zap } as const;
</script>

<svelte:head>
	{#if vendor}
		<title>TenantIQ vs {vendor.name} — 1-pager</title>
		<meta name="robots" content="noindex" />
	{/if}
</svelte:head>

{#if !vendor}
	<div class="missing"><h1>Comparison not found</h1><p><a href="/compare">/compare</a></p></div>
{:else}
	<div class="page">
		<header>
			<div class="brand">
				<strong>TenantIQ</strong>
				<span class="brand-sub">M365 control plane for MSPs</span>
			</div>
			<div class="meta">
				<span>vs <strong>{vendor.name}</strong></span>
				<span>{today}</span>
			</div>
		</header>

		<h1>TenantIQ vs {vendor.name}</h1>
		<p class="tagline">{vendor.tagline}</p>

		<div class="counts">
			<div class="count"><span class="big">{tenantiqUnique}</span><span class="lbl">TenantIQ-unique</span></div>
			<div class="count"><span class="big">{themWins}</span><span class="lbl">where {vendor.name.split(' ')[0]} wins</span></div>
			<div class="count"><span class="big">{rows.length}</span><span class="lbl">capabilities compared</span></div>
		</div>

		<p class="subhead">{vendor.subhead}</p>

		<table>
			<thead>
				<tr><th>Capability</th><th>TenantIQ</th><th>{vendor.name.split(' ')[0]}</th></tr>
			</thead>
			<tbody>
				{#each rows as r (r.feature)}
					{@const TenantiqIcon = statusIcon[r.tenantiq.status]}
					{@const ThemIcon = statusIcon[r.them.status]}
					<tr>
						<td class="feature">
							<strong>{r.feature}</strong>
							{#if r.detail}<p>{r.detail}</p>{/if}
						</td>
						<td class="cell {r.tenantiq.status}">
							<span class="pill"><TenantiqIcon size={11} /> {r.tenantiq.status === 'unique' ? 'Only' : r.tenantiq.status}</span>
							{#if r.tenantiq.note}<small>{r.tenantiq.note}</small>{/if}
						</td>
						<td class="cell {r.them.status}">
							<span class="pill"><ThemIcon size={11} /> {r.them.status === 'unique' ? 'Only' : r.them.status}</span>
							{#if r.them.note}<small>{r.them.note}</small>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		{#if vendor.dontFightOn.length > 0}
			<section class="honest">
				<h3>Where {vendor.name.split(' ')[0]} legitimately wins</h3>
				<ul>
					{#each vendor.dontFightOn as item}<li>{item}</li>{/each}
				</ul>
			</section>
		{/if}

		<footer>
			<p><strong>Pilot offer:</strong> 14 days, three of your tenants, dry-run mode only — zero Graph mutations. You decide if the autonomous narrative fits. <strong>app.tenantiq.app</strong> · info@finsavvyai.com</p>
			{#if vendor.dossierUrl}
				<p class="dossier-link">Full sourced dossier: <code>{vendor.dossierUrl}</code></p>
			{/if}
		</footer>

		<div class="print-hint no-print">
			<button onclick={() => window.print()}>Save as PDF (⌘ P / Ctrl P)</button>
			<a href="/compare/{slug}">Back to comparison</a>
		</div>
	</div>
{/if}

<style>
	:global(body) { background: white; color: #111; }
	.page { max-width: 760px; margin: 0 auto; padding: 2rem 2.5rem; font-family: -apple-system, system-ui, sans-serif; color: #111; line-height: 1.5; }
	.missing { padding: 4rem 2rem; text-align: center; color: #111; }

	header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 0.75rem; border-bottom: 2px solid #ef4444; margin-bottom: 1.25rem; }
	.brand strong { font-size: 1.125rem; color: #ef4444; }
	.brand-sub { display: block; font-size: 0.75rem; color: #666; }
	.meta { text-align: right; font-size: 0.75rem; color: #666; display: flex; flex-direction: column; gap: 0.125rem; }

	h1 { font-size: 1.875rem; font-weight: 800; margin: 0 0 0.25rem; letter-spacing: -0.01em; }
	.tagline { font-size: 1rem; color: #444; margin: 0 0 1rem; }
	.counts { display: flex; gap: 1.5rem; padding: 0.875rem 1rem; background: #f7f7f9; border-radius: 8px; margin-bottom: 1rem; }
	.count { display: flex; flex-direction: column; gap: 0.125rem; }
	.big { font-size: 1.5rem; font-weight: 800; color: #ef4444; line-height: 1; }
	.lbl { font-size: 0.6875rem; color: #555; text-transform: uppercase; letter-spacing: 0.04em; }
	.subhead { font-size: 0.875rem; color: #333; margin: 0 0 1.25rem; }

	table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	thead { background: #f3f4f6; }
	th { text-align: left; padding: 0.5rem 0.625rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
	td { padding: 0.5rem 0.625rem; vertical-align: top; border-top: 1px solid #e5e7eb; }
	td.feature strong { font-size: 0.8125rem; color: #111; }
	td.feature p { font-size: 0.75rem; color: #555; margin: 0.125rem 0 0; line-height: 1.4; }
	td.cell { white-space: nowrap; min-width: 90px; }
	td.cell small { display: block; font-size: 0.6875rem; color: #555; white-space: normal; margin-top: 0.125rem; }
	.pill { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; text-transform: capitalize; }
	td.cell.yes .pill { background: #dcfce7; color: #166534; }
	td.cell.no .pill { background: #f3f4f6; color: #6b7280; }
	td.cell.partial .pill { background: #fef3c7; color: #92400e; }
	td.cell.unique .pill { background: #fee2e2; color: #991b1b; }

	.honest { margin-top: 1.25rem; padding: 0.875rem 1rem; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 0 6px 6px 0; }
	.honest h3 { font-size: 0.8125rem; font-weight: 700; margin: 0 0 0.375rem; color: #92400e; text-transform: uppercase; letter-spacing: 0.04em; }
	.honest ul { list-style: none; padding: 0; margin: 0; }
	.honest li { font-size: 0.8125rem; color: #333; padding: 0.125rem 0 0.125rem 1rem; position: relative; }
	.honest li::before { content: '•'; position: absolute; left: 0.25rem; color: #f59e0b; font-weight: bold; }

	footer { margin-top: 1.5rem; padding-top: 0.875rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #555; }
	footer p { margin: 0.25rem 0; }
	footer code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.6875rem; word-break: break-all; }
	.dossier-link { color: #888; }

	.print-hint { margin-top: 2rem; text-align: center; padding: 1rem; background: #fef9c3; border-radius: 8px; font-size: 0.875rem; }
	.print-hint button { padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 0.75rem; }
	.print-hint a { color: #ef4444; text-decoration: none; }

	@media print {
		.no-print { display: none !important; }
		.page { padding: 0.5in; max-width: none; }
		header { page-break-after: avoid; }
		.honest, footer { page-break-inside: avoid; }
		table { page-break-inside: auto; }
		tr { page-break-inside: avoid; }
		@page { size: letter; margin: 0.5in; }
	}
</style>
