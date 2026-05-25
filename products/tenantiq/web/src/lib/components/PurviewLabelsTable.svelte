<script lang="ts">
	interface SensitivityLabel {
		name: string;
		scope: string;
		encryption: boolean;
		autoLabeling: boolean;
		usageCount: number;
	}

	interface Props {
		labels: SensitivityLabel[];
	}

	let { labels }: Props = $props();
</script>

<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
	<div class="border-b border-[var(--color-border)] px-4 py-3">
		<h3 class="text-sm font-semibold text-[var(--color-text)]">Sensitivity Labels</h3>
	</div>
	<div class="overflow-x-auto">
		<table class="w-full text-left text-xs">
			<thead>
				<tr class="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
					<th class="px-4 py-2 font-medium">Label</th>
					<th class="px-4 py-2 font-medium">Scope</th>
					<th class="px-4 py-2 font-medium">Encryption</th>
					<th class="px-4 py-2 font-medium">Auto-Labeling</th>
					<th class="px-4 py-2 font-medium text-right">Usage</th>
				</tr>
			</thead>
			<tbody>
				{#each labels as l}
					<tr class="border-b border-[var(--color-border)] last:border-0">
						<td class="px-4 py-2.5 font-medium text-[var(--color-text)]">{l.name}</td>
						<td class="px-4 py-2.5 text-[var(--color-text-secondary)]">{l.scope}</td>
						<td class="px-4 py-2.5">
							{#if l.encryption}
								<span class="text-[var(--color-success)]">Enabled</span>
							{:else}
								<span class="text-[var(--color-text-secondary)]">Off</span>
							{/if}
						</td>
						<td class="px-4 py-2.5">
							{#if l.autoLabeling}
								<span class="text-[var(--color-success)]">Enabled</span>
							{:else}
								<span class="text-[var(--color-text-secondary)]">Off</span>
							{/if}
						</td>
						<td class="px-4 py-2.5 text-right text-[var(--color-text)]">
							{l.usageCount > 0 ? l.usageCount.toLocaleString() : '--'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
