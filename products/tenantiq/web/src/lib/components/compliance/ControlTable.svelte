<script lang="ts">
	import AIExplainer from './AIExplainer.svelte';

	interface ControlResult {
		id: string; name: string; framework: string;
		status: 'pass' | 'fail' | 'partial' | 'error';
		evidence: string; remediation?: string; errorMessage?: string;
	}
	interface Props { framework: string; controls: ControlResult[] }
	let { framework, controls }: Props = $props();
	let expandedId = $state<string | null>(null);

	function statusClass(s: string) {
		if (s === 'pass') return 'pill-success';
		if (s === 'fail') return 'pill-danger';
		if (s === 'error') return 'pill-muted';
		return 'pill-warning';
	}
	function toggle(id: string) { expandedId = expandedId === id ? null : id; }
</script>

<div class="overflow-x-auto">
	<table class="table-premium w-full">
		<thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Evidence</th></tr></thead>
		<tbody>
			{#each controls as ctrl}
				<tr class="cursor-pointer hover:bg-[var(--color-bg-secondary)]" onclick={() => toggle(ctrl.id)}>
					<td class="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">{ctrl.id}</td>
					<td class="text-[var(--color-text)]">{ctrl.name}</td>
					<td>
						<span title={ctrl.status === 'error' ? (ctrl.errorMessage ?? 'Unable to assess') : ''}
							class="{statusClass(ctrl.status)} capitalize">
							{ctrl.status === 'error' ? 'N/A' : ctrl.status}
						</span>
					</td>
					<td class="text-xs text-[var(--color-text-secondary)] max-w-xs truncate">
						{ctrl.status === 'error' ? (ctrl.errorMessage ?? 'Unable to assess') : ctrl.evidence}
					</td>
				</tr>
				{#if expandedId === ctrl.id && (ctrl.status === 'fail' || ctrl.status === 'partial')}
					<tr>
						<td colspan="4" class="bg-[var(--color-bg-secondary)] px-6 py-4">
							<AIExplainer {framework} controlId={ctrl.id} />
							{#if ctrl.remediation}
								<div class="mt-2 text-xs text-[var(--color-text-secondary)]">
									<strong class="text-[var(--color-text)]">Static remediation:</strong> {ctrl.remediation}
								</div>
							{/if}
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>
