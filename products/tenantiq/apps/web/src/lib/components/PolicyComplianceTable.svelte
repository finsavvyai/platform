<script lang="ts">
	interface Policy {
		category: string;
		name: string;
		current: string;
		recommended: string;
		status: string;
		severity: string;
		benchmark: string;
	}

	interface Props {
		policies: Policy[];
		onSelect?: (policy: Policy) => void;
	}

	let { policies, onSelect }: Props = $props();

	const grouped = $derived(() => {
		const map = new Map<string, Policy[]>();
		for (const p of policies) {
			const list = map.get(p.category) || [];
			list.push(p);
			map.set(p.category, list);
		}
		return map;
	});

	function statusLabel(status: string): string {
		const labels: Record<string, string> = {
			compliant: 'Compliant', partial: 'Partial',
			non_compliant: 'Non-compliant', missing: 'Missing',
		};
		return labels[status] ?? status;
	}

	function statusClass(status: string): string {
		const classes: Record<string, string> = {
			compliant: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
			partial: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
			non_compliant: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
			missing: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
		};
		return classes[status] ?? '';
	}

	function severityClass(severity: string): string {
		const classes: Record<string, string> = {
			critical: 'text-[var(--color-danger)]',
			high: 'text-[var(--color-warning)]',
			medium: 'text-[var(--color-warning)]',
			low: 'text-[var(--color-primary)]',
		};
		return classes[severity] ?? '';
	}
</script>

<div>
	<h2 class="mb-3 text-lg font-semibold text-[var(--color-text)]">Policy Compliance</h2>

	{#each [...grouped().entries()] as [category, items]}
		<div class="mb-4">
			<h3 class="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">{category}</h3>
			<div class="overflow-x-auto rounded-lg border border-[var(--color-border)]">
				<table class="min-w-full">
					<thead class="bg-[var(--color-bg)]">
						<tr>
							<th class="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">Policy</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">Current</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">Recommended</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
						{#each items as policy}
							<tr
								class="transition-colors {onSelect ? 'cursor-pointer hover:bg-[var(--color-bg-secondary)]' : ''}"
								onclick={() => onSelect?.(policy)}
							>
								<td class="px-4 py-2.5">
									<p class="text-sm font-medium text-[var(--color-text)]">{policy.name}</p>
									<p class="text-xs text-[var(--color-text-secondary)]">
										<span class={severityClass(policy.severity)}>{policy.severity}</span>
										&middot; {policy.benchmark}
									</p>
								</td>
								<td class="px-4 py-2.5 text-sm text-[var(--color-text-secondary)]">{policy.current}</td>
								<td class="px-4 py-2.5 text-sm text-[var(--color-text-secondary)]">{policy.recommended}</td>
								<td class="px-4 py-2.5">
									<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {statusClass(policy.status)}">
										{statusLabel(policy.status)}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/each}
</div>
