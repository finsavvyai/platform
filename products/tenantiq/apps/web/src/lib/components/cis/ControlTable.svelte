<script lang="ts">
	import RemediationDetailPanel from '$lib/components/RemediationDetailPanel.svelte';
	import AIExplainer from './AIExplainer.svelte';
	import { api } from '$api/client';
	import { tenant } from '$stores/tenant';

	interface Control {
		controlId: string;
		section: string;
		title: string;
		status: 'pass' | 'fail' | 'partial' | 'error';
		severity: string;
		currentValue: string;
		expectedValue: string;
		remediationHint: string;
		portalUrl?: string;
		remediationGuide?: string;
		autoRemediable?: boolean;
	}

	interface Props {
		controls: Control[];
		filterSection?: string;
		filterStatus?: string;
	}

	let { controls, filterSection = 'all', filterStatus = 'all' }: Props = $props();
	let expandedId = $state<string | null>(null);

	const filtered = $derived(controls.filter(c =>
		(filterSection === 'all' || c.section === filterSection) &&
		(filterStatus === 'all' || c.status === filterStatus)
	));

	const statusColors: Record<string, string> = {
		pass: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
		fail: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
		partial: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
		error: 'bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]',
	};

	const severityColors: Record<string, string> = {
		critical: 'text-[var(--color-danger)]',
		high: 'text-[var(--color-warning)]',
		medium: 'text-[var(--color-text-secondary)]',
		low: 'text-[var(--color-text-tertiary)]',
	};

	function fixButtonColor(severity: string): string {
		if (severity === 'critical') return 'bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90';
		if (severity === 'high') return 'bg-[var(--color-warning)] text-white hover:bg-[var(--color-warning)]/90';
		return 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90';
	}
</script>

<div class="overflow-x-auto rounded-2xl border border-[var(--color-border)]" data-testid="cis-control-table">
	<table class="min-w-full">
		<thead class="bg-[var(--color-bg)]">
			<tr>
				<th class="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Control</th>
				<th class="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Section</th>
				<th class="px-3 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
				<th class="px-3 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Severity</th>
				<th class="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Current</th>
				<th class="px-3 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Action</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
			{#each filtered as ctrl (ctrl.controlId)}
				<tr class="cursor-pointer transition-colors hover:bg-[var(--color-bg-secondary)]" onclick={() => (expandedId = expandedId === ctrl.controlId ? null : ctrl.controlId)}>
					<td class="px-3 py-3">
						<span class="text-xs font-mono text-[var(--color-text-tertiary)]">{ctrl.controlId}</span>
						<p class="text-sm font-medium text-[var(--color-text)]">{ctrl.title}</p>
					</td>
					<td class="px-3 py-3 text-xs text-[var(--color-text-secondary)]">{ctrl.section}</td>
					<td class="px-3 py-3 text-center">
						<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize {statusColors[ctrl.status]}">
							{ctrl.status}
						</span>
					</td>
					<td class="px-3 py-3 text-center text-xs font-medium capitalize {severityColors[ctrl.severity]}" data-testid="severity-badge">{ctrl.severity}</td>
					<td class="px-3 py-3 text-xs text-[var(--color-text-secondary)]">{ctrl.currentValue}</td>
					<td class="px-3 py-3 text-center">
						{#if ctrl.status === 'fail' || ctrl.status === 'partial'}
							<div class="flex items-center justify-center gap-1.5">
								{#if ctrl.portalUrl}
									<a href={ctrl.portalUrl} target="_blank" rel="noopener noreferrer"
										onclick={(e) => e.stopPropagation()}
										class="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all {fixButtonColor(ctrl.severity)}">
										Fix in Azure
									</a>
								{/if}
								{#if ctrl.autoRemediable}
									<button disabled title="Coming soon"
										onclick={(e) => e.stopPropagation()}
										class="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed">
										Quick Fix
									</button>
								{/if}
							</div>
						{/if}
					</td>
				</tr>
				{#if expandedId === ctrl.controlId}
					<tr>
						<td colspan="6" class="bg-[var(--color-bg-secondary)] px-6 py-4">
							{#if ctrl.status === 'fail' || ctrl.status === 'partial'}
								<AIExplainer controlId={ctrl.controlId} />
							{/if}
							<RemediationDetailPanel
								data={{
									id: ctrl.controlId,
									title: ctrl.title,
									section: ctrl.section,
									severity: ctrl.severity as any,
									status: ctrl.status,
									currentValue: ctrl.currentValue,
									expectedValue: ctrl.expectedValue,
									description: ctrl.remediationHint,
									remediationGuide: ctrl.remediationGuide,
									portalUrl: ctrl.portalUrl,
									portalLabel: 'Open in Microsoft Entra',
									graphAutoFixAvailable: ctrl.autoRemediable === true,
									playwrightAutoFixAvailable: true,
								}}
								onRecheck={async (id) => {
									if (!$tenant.currentTenantId) throw new Error('No tenant selected');
									await api.post('/cis-benchmark/recheck', { controlId: id });
								}}
								onAutoFixGraph={async (id) => {
									if (!$tenant.currentTenantId) throw new Error('No tenant selected');
									await api.post('/cis-benchmark/remediate', { controlId: id, mode: 'graph' });
								}}
								onAutoFixPlaywright={async (id) => {
									if (!$tenant.currentTenantId) throw new Error('No tenant selected');
									await api.post('/cis-benchmark/remediate', { controlId: id, mode: 'browser' });
								}}
							/>
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>
