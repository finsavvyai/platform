<script lang="ts">
	interface DlpPolicy {
		name: string;
		status: 'active' | 'test' | 'disabled' | 'not_created';
		sensitiveTypes: string[];
		locations: string[];
		actions: string[];
		matchCount: number;
		falsePositiveRate: number;
	}

	interface Props {
		policies: DlpPolicy[];
	}

	let { policies }: Props = $props();

	const statusStyles: Record<string, string> = {
		active: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
		test: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
		disabled: 'bg-[var(--color-text-secondary)]/15 text-[var(--color-text-secondary)]',
		not_created: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
	};

	const statusLabel: Record<string, string> = {
		active: 'Active',
		test: 'Test Mode',
		disabled: 'Disabled',
		not_created: 'Not Created',
	};
</script>

<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
	<div class="border-b border-[var(--color-border)] px-4 py-3">
		<h3 class="text-sm font-semibold text-[var(--color-text)]">DLP Policies</h3>
	</div>
	<div class="overflow-x-auto">
		<table class="w-full text-left text-xs">
			<thead>
				<tr class="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
					<th class="px-4 py-2 font-medium">Policy</th>
					<th class="px-4 py-2 font-medium">Status</th>
					<th class="px-4 py-2 font-medium">Sensitive Types</th>
					<th class="px-4 py-2 font-medium">Locations</th>
					<th class="px-4 py-2 font-medium text-right">Matches (30d)</th>
					<th class="px-4 py-2 font-medium text-right">FP Rate</th>
				</tr>
			</thead>
			<tbody>
				{#each policies as p}
					<tr class="border-b border-[var(--color-border)] last:border-0">
						<td class="px-4 py-2.5 font-medium text-[var(--color-text)]">{p.name}</td>
						<td class="px-4 py-2.5">
							<span class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium {statusStyles[p.status]}">
								{statusLabel[p.status]}
							</span>
						</td>
						<td class="max-w-[200px] px-4 py-2.5 text-[var(--color-text-secondary)]">
							{p.sensitiveTypes.length > 0 ? p.sensitiveTypes.join(', ') : '--'}
						</td>
						<td class="px-4 py-2.5 text-[var(--color-text-secondary)]">
							{p.locations.length > 0 ? p.locations.join(', ') : '--'}
						</td>
						<td class="px-4 py-2.5 text-right text-[var(--color-text)]">
							{p.matchCount > 0 ? p.matchCount.toLocaleString() : '--'}
						</td>
						<td class="px-4 py-2.5 text-right text-[var(--color-text-secondary)]">
							{p.matchCount > 0 ? `${(p.falsePositiveRate * 100).toFixed(0)}%` : '--'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
