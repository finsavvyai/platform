<script lang="ts">
	import RemediationDetailPanel from '$lib/components/RemediationDetailPanel.svelte';
	import { HARDENING_GUIDES } from './hardening-guides';
	import { toasts } from '$stores/toast';

	interface HardeningAction {
		id: string;
		title: string;
		description: string;
		impact: 'Critical' | 'High' | 'Medium';
		affectedCount: number;
		reversible: boolean;
		enabled: boolean;
		status: 'pending' | 'running' | 'success' | 'failed';
	}

	interface Props {
		action: HardeningAction;
		onToggle: (id: string) => void;
	}

	let { action, onToggle }: Props = $props();

	let expanded = $state(false);
	const guide = $derived(HARDENING_GUIDES[action.id]);

	const impactColor = {
		Critical: 'bg-[#dc2626]/10 text-[#dc2626] border-[#dc2626]/30',
		High: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/30',
		Medium: 'bg-[#eab308]/10 text-[#eab308] border-[#eab308]/30'
	};

	const statusIcon = {
		pending: '○',
		running: '◐',
		success: '✓',
		failed: '✕'
	};

	const statusColor = {
		pending: 'text-[var(--color-text-tertiary)]',
		running: 'text-[var(--color-primary)] animate-spin',
		success: 'text-[#16a34a]',
		failed: 'text-[#dc2626]'
	};
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 hover:border-[var(--color-border-strong)]">
	<div class="flex items-start gap-4 p-4">
		<input
			type="checkbox"
			checked={action.enabled}
			onchange={() => onToggle(action.id)}
			disabled={action.status !== 'pending'}
			class="mt-1 h-5 w-5 rounded border-[var(--color-border)] transition-colors accent-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
		/>

		<div class="flex-1 min-w-0">
			<div class="flex items-start justify-between gap-2">
				<div class="flex-1">
					<h3 class="text-sm font-medium text-[var(--color-text)]">{action.title}</h3>
					<p class="mt-1 text-xs text-[var(--color-text-secondary)]">{action.description}</p>
				</div>
				<span class={`inline-flex items-center gap-1 text-sm font-medium transition-colors ${statusColor[action.status]}`}>
					<span class="text-lg leading-none">{statusIcon[action.status]}</span>
				</span>
			</div>

			<div class="mt-3 flex flex-wrap items-center gap-2">
				<span class={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${impactColor[action.impact]}`}>
					{action.impact} impact
				</span>

				{#if action.affectedCount > 0}
					<span class="text-xs text-[var(--color-text-tertiary)]">
						Affects <strong>{action.affectedCount}</strong> {action.affectedCount === 1 ? 'user' : 'users'}
					</span>
				{/if}

				<span class="text-xs text-[var(--color-text-tertiary)]">
					{action.reversible ? '↔️ Reversible' : '⚠️ Not reversible'}
				</span>

				<button
					type="button"
					onclick={() => (expanded = !expanded)}
					class="ml-auto text-xs font-medium text-[var(--color-primary)] hover:underline"
				>
					{expanded ? 'Hide details' : 'See full fix guide →'}
				</button>
			</div>
		</div>
	</div>

	{#if expanded}
		<div class="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
			<RemediationDetailPanel
				data={{
					id: action.id,
					title: action.title,
					severity: (action.impact.toLowerCase() as any),
					description: action.description,
					whyItMatters: guide?.whyItMatters,
					remediationSteps: guide?.steps,
					portalUrl: guide?.portalUrl,
					portalLabel: guide?.portalLabel,
					graphAutoFixAvailable: action.reversible,
					playwrightAutoFixAvailable: true,
				}}
				onAutoFixGraph={async () => {
					toasts.error('Single-action auto-fix runs as part of the Hardening Wizard execute flow. Click "Preview Changes" to proceed.');
				}}
				onAutoFixPlaywright={async () => {
					toasts.error('Browser-based hardening is in beta and coming soon.');
				}}
			/>
		</div>
	{/if}
</div>
