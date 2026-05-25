<script lang="ts">
	import type { Alert } from '$lib/types/shared';
	import SeverityBadge from './SeverityBadge.svelte';
	import RemediationPlanBody from './RemediationPlanBody.svelte';
	import UpsellCard from './UpsellCard.svelte';
	import { api, UpgradeRequiredError, type UpsellInfo } from '$api/client';
	import { tenant } from '$stores/tenant';
	import { formatRelativeTime } from '$utils/format';
	import { trapFocus } from '$utils/focus-trap';
	import { untrack } from 'svelte';
	import { shareAlert, isShareSupported } from '$utils/web-share';

	interface RemediationPlan {
		impactLevel: any; impactExplanation: string; riskScore: number;
		affectedUsers: any[]; affectedResources: any[]; steps: any[];
		estimatedMinutes: number; reversible: boolean;
		positiveOutcomes: string[]; negativeOutcomes: string[]; userEffects: string[];
	}
	interface Props {
		alert: Alert; onClose: () => void;
		onRemediate?: (alert: Alert) => void; onDismiss?: (alert: Alert) => void;
	}

	let { alert, onClose, onRemediate, onDismiss }: Props = $props();
	let plan = $state<RemediationPlan | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let confirming = $state(false);
	let dryRunning = $state(false);
	let visible = $state(false);
	let upsell = $state<{ message: string; upsell: UpsellInfo } | null>(null);

	$effect(() => { requestAnimationFrame(() => { visible = true; }); });
	$effect(() => { untrack(() => loadPlan()); });

	function handleClose() { visible = false; setTimeout(onClose, 300); }

	async function loadPlan() {
		loading = true; error = null;
		try {
			plan = await api.get<RemediationPlan>(`/tenants/${$tenant.currentTenantId}/alerts/${alert.id}/remediation-plan`);
		} catch (e) { error = e instanceof Error ? e.message : 'Failed to load plan'; }
		finally { loading = false; }
	}

	async function handleDryRun() {
		dryRunning = true;
		upsell = null;
		try { await api.post(`/tenants/${$tenant.currentTenantId}/alerts/${alert.id}/remediate`, { dryRun: true }); }
		catch (e) {
			if (e instanceof UpgradeRequiredError) {
				upsell = { message: e.message, upsell: e.upsell };
			} else {
				console.error('[AlertDetail] dry run failed', e);
			}
		}
		finally { dryRunning = false; }
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && handleClose()} />

<div class="fixed inset-0 z-40 transition-opacity duration-300" class:opacity-0={!visible} class:opacity-100={visible}>
	<div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick={handleClose} role="presentation"></div>
</div>

<div
	use:trapFocus
	class="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-2xl)] transition-transform duration-300 sm:max-w-xl"
	class:translate-x-full={!visible} class:translate-x-0={visible}
	role="dialog" aria-modal="true" aria-label="Alert detail: {alert.title}" tabindex="-1"
>
	<!-- Gradient severity header strip -->
	<div class="h-1 w-full {alert.severity === 'critical' ? 'bg-gradient-to-r from-red-500 to-red-600' : alert.severity === 'high' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : alert.severity === 'medium' ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}"></div>

	<header class="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface-glass)] px-6 py-5 backdrop-blur-xl">
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0">
				<div class="flex items-center gap-2.5">
					<SeverityBadge severity={alert.severity} size="md" />
					<span class="rounded-md bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">{alert.category}</span>
				</div>
				<h2 class="mt-3 text-lg font-bold tracking-tight text-[var(--color-text)]">{alert.title}</h2>
				<p class="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
					<span class="inline-block h-1 w-1 rounded-full bg-[var(--color-text-tertiary)]"></span>
					{formatRelativeTime(alert.createdAt)}
					<span class="inline-block h-1 w-1 rounded-full bg-[var(--color-text-tertiary)]"></span>
					<span class="font-mono text-[11px]">{alert.ruleId}</span>
				</p>
			</div>
			<div class="flex shrink-0 items-center gap-1">
				<button
					onclick={() => shareAlert({ id: alert.id, title: alert.title, severity: alert.severity, tenantId: $tenant.currentTenantId ?? '' })}
					class="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]"
					aria-label="Share alert"
					title="Share alert"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
						<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
					</svg>
				</button>
				<button onclick={handleClose} class="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]" aria-label="Close panel">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
		</div>
	</header>

	{#if loading}
		<div class="flex flex-1 items-center justify-center p-8">
			<p class="text-sm text-[var(--color-text-secondary)]">Loading remediation plan...</p>
		</div>
	{:else if error}
		<div class="p-6">
			<p class="text-sm text-[var(--color-danger)]">{error}</p>
			<button onclick={loadPlan} class="mt-2 text-sm font-medium text-[var(--color-primary)]">Retry</button>
		</div>
	{:else if plan}
		<RemediationPlanBody {plan} />

		{#if upsell}
			<div class="px-6 pb-3">
				<UpsellCard message={upsell.message} upsell={upsell.upsell} onDismiss={() => upsell = null} />
			</div>
		{/if}

		<footer class="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-surface-glass)] px-6 py-4 backdrop-blur-xl">
			{#if confirming}
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm font-semibold text-[var(--color-danger)]">Confirm execution?</p>
					<div class="flex gap-2">
						<button onclick={() => (confirming = false)} class="min-h-[44px] rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-all hover:bg-[var(--color-bg-secondary)]">Cancel</button>
						<button onclick={() => { onRemediate?.(alert); confirming = false; }} class="min-h-[44px] rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(239,68,68,0.3)] transition-all hover:shadow-[0_4px_16px_rgba(239,68,68,0.4)] active:scale-[0.98]">Execute</button>
					</div>
				</div>
			{:else}
				<div class="flex flex-wrap gap-2">
					<button onclick={handleDryRun} disabled={dryRunning} class="min-h-[44px] rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-all hover:bg-[var(--color-bg-secondary)] disabled:opacity-50">{dryRunning ? 'Running...' : 'Dry Run'}</button>
					{#if alert.remediationType !== 'manual' && onRemediate}
						<button onclick={() => (confirming = true)} class="min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-600)] px-5 py-2 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(59,108,245,0.3)] transition-all hover:shadow-[0_4px_16px_rgba(59,108,245,0.4)] active:scale-[0.98]">Execute Remediation</button>
					{/if}
					{#if onDismiss}
						<button onclick={() => onDismiss?.(alert)} class="min-h-[44px] rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-bg-secondary)]">Dismiss</button>
					{/if}
				</div>
			{/if}
		</footer>
	{/if}
</div>
