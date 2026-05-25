<script lang="ts">
	import { api } from '$api/client';
	import { tenant } from '$stores/tenant';
	import { toasts } from '$stores/toast';
	import { Sparkles, Check, Loader2, ArrowRight } from 'lucide-svelte';

	interface Template {
		id: string;
		name: string;
		tagline: string;
		description: string;
		category: 'onboarding' | 'compliance' | 'cost' | 'incident-response';
		skillIds: string[];
		requiredScopes: string[];
		estMinutesToValue: number;
		includedInPlan: 'starter' | 'professional' | 'enterprise';
	}

	let templates = $state<Template[]>([]);
	let loading = $state(true);
	let applyingId = $state<string | null>(null);

	$effect(() => { if ($tenant.currentTenantId) load(); });

	async function load() {
		loading = true;
		try {
			const res = await api.get<{ templates: Template[] }>(`/tenants/${$tenant.currentTenantId}/skill-templates`);
			templates = res.templates ?? [];
		} catch { templates = []; }
		finally { loading = false; }
	}

	async function apply(t: Template) {
		applyingId = t.id;
		try {
			const res = await api.post<{ activated: string[]; alreadyActive: string[] }>(
				`/tenants/${$tenant.currentTenantId}/skill-templates/${t.id}/apply`,
				{},
			);
			const n = res.activated.length;
			const skipped = res.alreadyActive.length;
			toasts.success(
				n > 0
					? `${t.name}: activated ${n} skill${n === 1 ? '' : 's'}${skipped ? ` (${skipped} already active)` : ''}`
					: `${t.name}: all skills already active`,
			);
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Could not apply template');
		} finally {
			applyingId = null;
		}
	}

	const catLabel: Record<Template['category'], string> = {
		onboarding: 'Onboarding',
		compliance: 'Compliance',
		cost: 'Cost',
		'incident-response': 'Incident Response',
	};
	const catColor: Record<Template['category'], string> = {
		onboarding: 'var(--color-success)',
		compliance: 'var(--color-primary)',
		cost: 'var(--color-warning)',
		'incident-response': 'var(--color-danger)',
	};
</script>

<section class="templates-section">
	<header>
		<div class="head-text">
			<Sparkles size={18} />
			<div>
				<h2>Agent templates</h2>
				<p>Pre-bundled skills + connectors + guardrails. One click activates the full bundle for this tenant.</p>
			</div>
		</div>
	</header>

	{#if loading}
		<div class="grid">
			{#each Array(4) as _}<div class="card-skel"></div>{/each}
		</div>
	{:else if templates.length === 0}
		<p class="empty">No templates available yet.</p>
	{:else}
		<div class="grid">
			{#each templates as t (t.id)}
				<div class="t-card">
					<div class="t-head">
						<span class="cat-pill" style="background: color-mix(in srgb, {catColor[t.category]} 12%, transparent); color: {catColor[t.category]};">{catLabel[t.category]}</span>
						<span class="t-time">~{t.estMinutesToValue} min</span>
					</div>
					<h3>{t.name}</h3>
					<p class="t-tagline">{t.tagline}</p>
					<p class="t-desc">{t.description}</p>
					<div class="t-meta">
						<span class="t-meta-item"><strong>{t.skillIds.length}</strong> skill{t.skillIds.length === 1 ? '' : 's'}</span>
						<span class="t-meta-item"><strong>{t.requiredScopes.length}</strong> Graph scope{t.requiredScopes.length === 1 ? '' : 's'}</span>
						<span class="t-meta-item plan {t.includedInPlan}">{t.includedInPlan}</span>
					</div>
					<button
						class="apply-btn"
						disabled={applyingId === t.id}
						onclick={() => apply(t)}
					>
						{#if applyingId === t.id}
							<Loader2 size={14} class="spin" /> Applying…
						{:else}
							<Check size={14} /> Apply template <ArrowRight size={12} />
						{/if}
					</button>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.templates-section { margin-bottom: 2rem; padding: 1.5rem; border: 1px solid var(--color-border); border-radius: 0.75rem; background: color-mix(in srgb, var(--color-primary) 3%, var(--color-surface)); }
	.templates-section header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
	.head-text { display: flex; gap: 0.625rem; align-items: flex-start; }
	.head-text h2 { font-size: 1rem; font-weight: 600; margin: 0 0 0.125rem 0; }
	.head-text p { font-size: 0.8125rem; color: var(--color-text-secondary); margin: 0; max-width: 540px; }
	.grid { display: grid; gap: 0.875rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
	.card-skel { height: 220px; border-radius: 0.5rem; background: var(--color-bg-tertiary); animation: pulse 1.5s ease-in-out infinite; }
	@keyframes pulse { 50% { opacity: 0.4; } }
	.t-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.625rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
	.t-head { display: flex; justify-content: space-between; align-items: center; }
	.cat-pill { font-size: 0.6875rem; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
	.t-time { font-size: 0.6875rem; color: var(--color-text-tertiary); }
	.t-card h3 { font-size: 0.9375rem; font-weight: 600; margin: 0; color: var(--color-text); }
	.t-tagline { font-size: 0.8125rem; color: var(--color-text); font-style: italic; margin: 0; line-height: 1.4; }
	.t-desc { font-size: 0.75rem; color: var(--color-text-secondary); margin: 0; line-height: 1.5; flex: 1; }
	.t-meta { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
	.t-meta-item { font-size: 0.6875rem; color: var(--color-text-tertiary); }
	.t-meta-item strong { color: var(--color-text); }
	.t-meta-item.plan { padding: 0.125rem 0.375rem; border-radius: 0.25rem; text-transform: capitalize; font-weight: 500; }
	.t-meta-item.plan.starter { background: color-mix(in srgb, var(--color-success) 10%, transparent); color: var(--color-success); }
	.t-meta-item.plan.professional { background: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary); }
	.t-meta-item.plan.enterprise { background: color-mix(in srgb, var(--color-warning) 10%, transparent); color: var(--color-warning); }
	.apply-btn { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 0.875rem; background: var(--color-primary); color: white; border: none; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 500; cursor: pointer; min-height: 36px; transition: background 0.15s; margin-top: 0.5rem; }
	.apply-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--color-primary) 90%, white); }
	.apply-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	:global(.apply-btn .spin) { animation: spin 1s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.empty { color: var(--color-text-tertiary); font-size: 0.875rem; }
</style>
