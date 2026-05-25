<script lang="ts">
	/**
	 * Universal remediation detail panel.
	 * Shown inline (table row expansion) or as a drawer for:
	 *   - CIS controls
	 *   - Compliance framework controls
	 *   - Hardening wizard actions
	 *   - Alert remediation plans
	 *
	 * Every call-to-action is scoped via the passed `onRecheck` / `onAutoFix`
	 * callbacks so the host page keeps ownership of the backend contract.
	 */
	import { toasts } from '$stores/toast';

	export type RemediationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
	export type RemediationStatus = 'pass' | 'fail' | 'partial' | 'error';

	export interface RemediationEntity {
		name?: string;
		email?: string;
		detail?: string;
	}

	export interface RemediationProps {
		id: string;
		title: string;
		section?: string;
		severity?: RemediationSeverity;
		status?: RemediationStatus;
		currentValue?: string;
		expectedValue?: string;
		description?: string;
		whyItMatters?: string;
		remediationHint?: string;
		remediationGuide?: string;
		remediationSteps?: string[];
		portalUrl?: string;
		portalLabel?: string;
		graphAutoFixAvailable?: boolean;
		playwrightAutoFixAvailable?: boolean;
		affectedEntities?: RemediationEntity[];
		entitiesLabel?: string;
	}

	interface Props {
		data: RemediationProps;
		onRecheck?: (id: string) => Promise<void>;
		onAutoFixGraph?: (id: string) => Promise<void>;
		onAutoFixPlaywright?: (id: string) => Promise<void>;
	}

	let { data, onRecheck, onAutoFixGraph, onAutoFixPlaywright }: Props = $props();

	let recheckingNow = $state(false);
	let fixingGraph = $state(false);
	let fixingPlaywright = $state(false);

	const severityColor: Record<string, string> = {
		critical: 'text-[var(--color-danger)]',
		high: 'text-[var(--color-warning)]',
		medium: 'text-[var(--color-warning)]',
		low: 'text-[var(--color-text-secondary)]',
		info: 'text-[var(--color-primary)]',
	};

	async function handleRecheck() {
		if (!onRecheck || recheckingNow) return;
		recheckingNow = true;
		try {
			await onRecheck(data.id);
			toasts.success(`Re-check queued for ${data.title}`);
		} catch (err: any) {
			toasts.error(err?.message ?? 'Re-check failed');
		} finally {
			recheckingNow = false;
		}
	}

	async function handleGraphFix() {
		if (!onAutoFixGraph || fixingGraph) return;
		fixingGraph = true;
		try {
			await onAutoFixGraph(data.id);
			toasts.success('Fix applied via Microsoft Graph');
		} catch (err: any) {
			toasts.error(err?.message ?? 'Auto-fix failed');
		} finally {
			fixingGraph = false;
		}
	}

	async function handlePlaywrightFix() {
		if (!onAutoFixPlaywright || fixingPlaywright) return;
		fixingPlaywright = true;
		try {
			await onAutoFixPlaywright(data.id);
			toasts.success('Browser remediation started');
		} catch (err: any) {
			toasts.error(err?.message ?? 'Browser remediation failed');
		} finally {
			fixingPlaywright = false;
		}
	}

	// Derive step list from either explicit steps or a paragraph guide split on sentences.
	const steps = $derived(
		data.remediationSteps && data.remediationSteps.length > 0
			? data.remediationSteps
			: (data.remediationGuide ?? '').split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean),
	);
</script>

<div class="space-y-4 text-sm">
	<!-- Header row: severity + status -->
	<div class="flex flex-wrap items-center gap-2">
		{#if data.section}
			<span class="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">{data.section}</span>
		{/if}
		{#if data.severity}
			<span class="text-[11px] font-semibold uppercase {severityColor[data.severity] ?? ''}">{data.severity}</span>
		{/if}
		{#if data.status}
			<span class="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-medium capitalize text-[var(--color-text-secondary)]">{data.status}</span>
		{/if}
	</div>

	<!-- What / Why -->
	{#if data.description}
		<p class="text-[var(--color-text-secondary)]">{data.description}</p>
	{/if}

	{#if data.currentValue || data.expectedValue}
		<div class="grid gap-3 sm:grid-cols-2">
			{#if data.currentValue}
				<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
					<p class="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Current</p>
					<p class="mt-0.5 text-[var(--color-text)]">{data.currentValue}</p>
				</div>
			{/if}
			{#if data.expectedValue}
				<div class="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-3">
					<p class="text-[11px] uppercase tracking-wide text-[var(--color-success)]">Expected</p>
					<p class="mt-0.5 text-[var(--color-text)]">{data.expectedValue}</p>
				</div>
			{/if}
		</div>
	{/if}

	{#if data.whyItMatters}
		<div class="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-3 text-xs">
			<p class="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-warning)]">Why it matters</p>
			<p class="mt-1 text-[var(--color-text)]">{data.whyItMatters}</p>
		</div>
	{/if}

	<!-- Step-by-step -->
	{#if steps.length > 0}
		<div>
			<p class="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Step-by-step fix</p>
			<ol class="mt-2 space-y-1.5 text-xs text-[var(--color-text)]">
				{#each steps as step, i}
					<li class="flex gap-2">
						<span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[10px] font-semibold text-[var(--color-primary)]">{i + 1}</span>
						<span>{step}</span>
					</li>
				{/each}
			</ol>
		</div>
	{/if}

	<!-- Affected entities -->
	{#if data.affectedEntities && data.affectedEntities.length > 0}
		<div>
			<p class="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
				{data.entitiesLabel ?? 'Affected'} ({data.affectedEntities.length})
			</p>
			<div class="mt-2 max-h-48 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40 divide-y divide-[var(--color-border)]/60 text-xs">
				{#each data.affectedEntities as e}
					<div class="px-3 py-2">
						{#if e.name}<p class="font-medium text-[var(--color-text)]">{e.name}</p>{/if}
						{#if e.email}<p class="text-[11px] text-[var(--color-text-secondary)]">{e.email}</p>{/if}
						{#if e.detail}<p class="text-[11px] text-[var(--color-text-tertiary)]">{e.detail}</p>{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Action row -->
	<div class="flex flex-wrap items-center gap-2 pt-2">
		{#if data.portalUrl}
			<a
				href={data.portalUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]"
			>
				<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
					<path d="M6 3H3v10h10v-3M10 3h3v3M7 9l6-6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				{data.portalLabel ?? 'Open in Portal'}
			</a>
		{/if}

		{#if onRecheck}
			<button
				type="button"
				onclick={handleRecheck}
				disabled={recheckingNow}
				class="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
			>
				{#if recheckingNow}Re-checking…{:else}Re-check this control{/if}
			</button>
		{/if}

		{#if data.graphAutoFixAvailable && onAutoFixGraph}
			<button
				type="button"
				onclick={handleGraphFix}
				disabled={fixingGraph}
				class="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
			>
				{#if fixingGraph}Fixing…{:else}Auto-fix via Graph{/if}
			</button>
		{/if}

		{#if data.playwrightAutoFixAvailable && onAutoFixPlaywright}
			<button
				type="button"
				onclick={handlePlaywrightFix}
				disabled={fixingPlaywright}
				class="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20 disabled:opacity-50"
			>
				<span class="rounded-sm bg-[var(--color-warning)] px-1 text-[9px] font-bold uppercase text-white">Beta</span>
				{#if fixingPlaywright}Running browser fix…{:else}Auto-fix via browser{/if}
			</button>
		{/if}
	</div>
</div>
